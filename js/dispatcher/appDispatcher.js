/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const async = require('async')
const Serializer = require('./serializer')
const messages = require('../constants/messages')
let ipc
let processType
let currentWindow
let BrowserWindow

if (typeof process !== 'undefined') {
  if (process.type === 'renderer') {
    processType = 'renderer'
    ipc = require('electron').ipcRenderer
    currentWindow = require('../../app/renderer/currentWindow')
  } else if (process.type === 'browser') {
    processType = 'browser'
    BrowserWindow = require('electron').BrowserWindow
    ipc = require('electron').ipcMain
  }
} else if (typeof chrome !== 'undefined' && typeof chrome.ipcRenderer === 'function') {
  processType = 'extension-page'
  ipc = chrome.ipcRenderer // eslint-disable-line
} else {
  throw new Error('No ipc available in context')
}

class AppDispatcher {
  constructor () {
    this.callbacks = []
    this.promises = []
    this.dispatching = false
    this.dispatch = this.dispatch.bind(this)
  }

  /**
   * Register a Store's callback so that it may be invoked by an action.
   * If the registrant is a renderer process the callback will be stored
   * locally and an `app-dispatcher-register` message will be sent to the
   * main process using IPC.
   * @param {function} callback The callback to be registered.
   * @return {number} The index of the callback within the _callbacks array.
   */
  register (callback) {
    if (process.type === 'renderer') {
      ipc.send('app-dispatcher-register')
    }
    this.callbacks.push(callback)
    return this.callbacks.length - 1 // index
  }

  unregister (callback) {
    const index = this.callbacks.indexOf(callback)
    if (index !== -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * dispatch
   * Dispatches registered callbacks. If `dispatch` is called from the main process
   * it will run all the registered callbacks. If `dispatch` is called from a renderer
   * process it will run any local registered callbacks and then send messages.DISPATCH_ACTION
   * to the main process where the all other registered callbacks will be run. The main
   * process will not run any callbacks for the renderer process that send messages.DISPATCH_ACTION
   * @param  {object} payload The data from the action.
   */
  dispatch (payload) {
    if (payload.actionType === undefined) {
      throw new Error('Dispatcher: Undefined action for payload', payload)
    }

    if (this.dispatching) {
      dispatchCargo.push(payload)
    } else {
      this.dispatching = true
      setImmediate(this.dispatchInternal.bind(this, payload, doneDispatching))
    }
  }

  dispatchToOwnRegisteredCallbacks (payload) {
    // First create array of promises for callbacks to reference.
    const resolves = []
    const rejects = []
    this.promises = this.callbacks.map(function (_, i) {
      return new Promise(function (resolve, reject) {
        resolves[i] = resolve
        rejects[i] = reject
      })
    })
    // Dispatch to callbacks and resolve/reject promises.
    this.callbacks.forEach((callback, i) => {
      callback(payload)
      resolves[i](payload)
    })
    this.promises = []
  }

  dispatchInternal (payload, cb) {
    if (processType === 'renderer') {
      if (window.location.protocol === 'chrome-extension:') {
        cb()
        ipcCargo.push(payload)
        return
      } else {
        if (!payload.queryInfo || !payload.queryInfo.windowId || payload.queryInfo.windowId === currentWindow.getCurrentWindowId()) {
          this.dispatchToOwnRegisteredCallbacks(payload)
          // We still want to tell the browser prcoess about app actions for payloads with a windowId
          // specified for the current window, but we don't want the browser process to forward it back
          // to us.
          if (payload.queryInfo) {
            payload.queryInfo.alreadyHandledByRenderer = payload.queryInfo.windowId === currentWindow.getCurrentWindowId()
          }
        }
        cb()
        ipcCargo.push(payload)
        return
      }
    }

    this.dispatchToOwnRegisteredCallbacks(payload)
    cb()
  }

  waitFor (promiseIndexes, callback) {
    var selectedPromises = promiseIndexes.map((index) => this.promises[index])
    return Promise.all(selectedPromises).then(callback)
  }

  shutdown () {
    appDispatcher.dispatch = (payload) => {}
  }
}

const appDispatcher = new AppDispatcher()

const doneDispatching = () => {
  if (dispatchCargo.idle()) {
    appDispatcher.dispatching = false
  }
}

const dispatchCargo = async.cargo((task, callback) => {
  for (let i = 0; i < task.length; i++) {
    appDispatcher.dispatchInternal(task[i], () => {})
  }
  callback()
  doneDispatching()
}, 200)

const ipcCargo = async.cargo((tasks, callback) => {
  ipc.send(messages.DISPATCH_ACTION, Serializer.serialize(tasks))
  callback()
}, 200)

if (processType === 'browser') {
  ipc.on('app-dispatcher-register', (event) => {
    let registrant = event.sender
    const registrantCargo = async.cargo((tasks, callback) => {
      if (!registrant.isDestroyed()) {
        registrant.send(messages.DISPATCH_ACTION, Serializer.serialize(tasks))
      }
      callback()
    }, 20)

    const callback = function (payload) {
      try {
        if (registrant.isDestroyed()) {
          appDispatcher.unregister(callback)
        } else {
          registrantCargo.push(payload)
        }
      } catch (e) {
        appDispatcher.unregister(callback)
      }
    }
    event.sender.on('crashed', () => {
      appDispatcher.unregister(callback)
    })
    event.sender.on('destroyed', () => {
      appDispatcher.unregister(callback)
    })
    appDispatcher.register(callback)
  })

  const dispatchEventPayload = (event, payload) => {
    let queryInfo = payload.queryInfo || payload.frameProps || (payload.queryInfo = {})
    queryInfo = queryInfo.toJS ? queryInfo.toJS() : queryInfo
    let sender = event.sender
    if (!sender.isDestroyed()) {
      const hostWebContents = sender.hostWebContents
      sender = hostWebContents || sender
      const win = BrowserWindow.fromWebContents(sender)

      if (hostWebContents) {
        // received from an extension
        // only extension messages will have a hostWebContents
        // because other messages come from the main window

        // default to the windowId of the hostWebContents
        if (!queryInfo.windowId && win) {
          queryInfo.windowId = win.id
        }
      }
      payload.queryInfo = queryInfo
      if (win) {
        payload.senderWindowId = win.id
      }
      payload.senderTabId = event.sender.getId()
    }
    appDispatcher.dispatch(payload)
  }

  ipc.on(messages.DISPATCH_ACTION, (event, payload) => {
    payload = Serializer.deserialize(payload)

    for (var i = 0; i < payload.length; i++) {
      dispatchEventPayload(event, payload[i])
    }
  })
}

module.exports = appDispatcher
