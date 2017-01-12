/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const windowActions = require('../../js/actions/windowActions')
const windowStore = require('../../js/stores/windowStore')
const {getActiveFrame} = require('../../js/state/frameStateUtil')

const navigateSiteClickHandler = (formatUrl) => (site, isForSecondaryAction, shiftKey) => {
  const location = formatUrl(site)
  // When clicked make sure to hide autocomplete
  windowActions.setRenderUrlBarSuggestions(false)
  if (isForSecondaryAction) {
    windowActions.newFrame({
      location,
      partitionNumber: site && site.get && site.get('partitionNumber') || undefined
    }, !!shiftKey)
  } else {
    const activeFrame = getActiveFrame(windowStore.state)
    windowActions.loadUrl(activeFrame, location)
    windowActions.setUrlBarActive(false)
    windowActions.setUrlBarPreview(null)
  }
}

const frameClickHandler = (frameProps) =>
  windowActions.setActiveFrame(frameProps)

module.exports = {
  navigateSiteClickHandler,
  frameClickHandler
}
