/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Note that these are webpack requires, not CommonJS node requiring requires
const React = require('react')
const Immutable = require('immutable')
const ImmutableComponent = require('../components/immutableComponent')
const messages = require('../constants/messages')
const siteTags = require('../constants/siteTags')
const dragTypes = require('../constants/dragTypes')
const aboutActions = require('./aboutActions')
const dndData = require('../dndData')
const cx = require('../lib/classSet')
const SortableTable = require('../components/sortableTable')
const siteUtil = require('../state/siteUtil')
const iconSize = require('../../app/common/lib/faviconUtil').iconSize

const ipc = window.chrome.ipc

// Stylesheets
require('../../less/about/bookmarks.less')
require('../../node_modules/font-awesome/css/font-awesome.css')

class BookmarkFolderItem extends React.Component {
  constructor () {
    super()
    this.state = {
      isDragOver: false
    }
  }
  onDragStart (e) {
    if (this.props.draggable !== false) {
      e.dataTransfer.effectAllowed = 'all'
      dndData.setupDataTransferURL(e.dataTransfer,
        this.props.bookmarkFolder.get('location'),
        this.props.bookmarkFolder.get('customTitle') || this.props.bookmarkFolder.get('title'))
      dndData.setupDataTransferBraveData(e.dataTransfer, dragTypes.BOOKMARK, this.props.bookmarkFolder)
    }
  }
  onDragOver (e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    this.setState({
      isDragOver: true
    })
  }
  onDragLeave (e) {
    this.setState({
      isDragOver: false
    })
  }
  /**
   * Move a folder, a bookmark, or multiple bookmarks IF move is allowed.
   * ex: won't allow child folder to become parent of an ancestor, etc.
   */
  moveBookmark (e, bookmark) {
    if (siteUtil.isMoveAllowed(this.props.allBookmarkFolders, bookmark, this.props.bookmarkFolder)) {
      aboutActions.moveSite(bookmark.toJS(),
        this.props.bookmarkFolder.toJS(),
        dndData.shouldPrependVerticalItem(e.target, e.clientY),
        true)
    }
  }
  // NOTE: both folders AND bookmarks can be dropped here
  onDrop (e) {
    this.setState({
      isDragOver: false
    })

    const bookmarkData = dndData.getDragData(e.dataTransfer, dragTypes.BOOKMARK)
    if (bookmarkData) {
      if (Immutable.List.isList(bookmarkData)) {
        bookmarkData.forEach((bookmark) => {
          this.moveBookmark(e, bookmark)
        })
        return
      }

      this.moveBookmark(e, bookmarkData)
    }
  }
  render () {
    const childBookmarkFolders = this.props.allBookmarkFolders
          .filter((bookmarkFolder) => (bookmarkFolder.get('parentFolderId') || 0) === this.props.bookmarkFolder.get('folderId'))
    return <div>
      <div role='listitem'
        onDrop={this.onDrop.bind(this)}
        onDragStart={this.onDragStart.bind(this)}
        onDragOver={this.onDragOver.bind(this)}
        onDragLeave={this.onDragLeave.bind(this)}
        onContextMenu={aboutActions.contextMenu.bind(this, this.props.bookmarkFolder.toJS(), 'bookmark-folder')}
        onClick={this.props.onChangeSelectedFolder.bind(null, this.props.bookmarkFolder.get('folderId'))}
        draggable={this.props.draggable !== false ? 'true' : 'false'}
        data-folder-id={this.props.bookmarkFolder.get('folderId')}
        className={cx({
          listItem: true,
          selected: this.props.selected,
          isDragOver: this.state.isDragOver
        })}>

        <span className={cx({
          bookmarkFolderIcon: true,
          fa: true,
          'fa-folder-o': !this.props.selected && !this.state.isDragOver,
          'fa-folder-open-o': this.props.selected || this.state.isDragOver
        })} />
        <span data-l10n-id={this.props.dataL10nId}>
          {this.props.bookmarkFolder.get('customTitle') || this.props.bookmarkFolder.get('title')}
        </span>
      </div>
      {
        childBookmarkFolders.size > 0
        ? <BookmarkFolderList
          search={this.props.search}
          onChangeSelectedFolder={this.props.onChangeSelectedFolder}
          bookmarkFolders={childBookmarkFolders}
          selectedFolderId={this.props.selectedFolderId}
          allBookmarkFolders={this.props.allBookmarkFolders} />
        : null
      }
    </div>
  }
}

class BookmarkFolderList extends ImmutableComponent {
  render () {
    return <list className='bookmarkFolderList'>
      {
        this.props.isRoot && this.props.search
        ? <div role='listitem' className='listItem selected'>
          <span className='bookmarkFolderIcon fa fa-search' />
          <span data-l10n-id='allFolders' />
        </div>
        : null
      }
      {
        this.props.isRoot
        ? <BookmarkFolderItem
          search={this.props.search}
          selected={!this.props.search && this.props.selectedFolderId === 0}
          dataL10nId='bookmarksToolbar'
          draggable={false}
          onChangeSelectedFolder={this.props.onChangeSelectedFolder}
          allBookmarkFolders={this.props.allBookmarkFolders}
          selectedFolderId={this.props.selectedFolderId}
          bookmarkFolder={Immutable.fromJS({folderId: 0, tags: [siteTags.BOOKMARK_FOLDER]})} />
        : null
      }
      {
        this.props.bookmarkFolders.map((bookmarkFolder) =>
          this.props.isRoot && bookmarkFolder.get('parentFolderId') === -1
          ? null
          : <BookmarkFolderItem bookmarkFolder={bookmarkFolder}
            allBookmarkFolders={this.props.allBookmarkFolders}
            search={this.props.search}
            selected={!this.props.search && this.props.selectedFolderId === bookmarkFolder.get('folderId')}
            selectedFolderId={this.props.selectedFolderId}
            onChangeSelectedFolder={this.props.onChangeSelectedFolder} />)
      }
      {
        this.props.isRoot
        ? <BookmarkFolderItem
          search={this.props.search}
          selected={!this.props.search && this.props.selectedFolderId === -1}
          dataL10nId='otherBookmarks'
          draggable={false}
          onChangeSelectedFolder={this.props.onChangeSelectedFolder}
          allBookmarkFolders={this.props.allBookmarkFolders}
          selectedFolderId={this.props.selectedFolderId}
          bookmarkFolder={Immutable.fromJS({folderId: -1, tags: [siteTags.BOOKMARK_FOLDER]})} />
        : null
      }
    </list>
  }
}

class BookmarkTitleHeader extends ImmutableComponent {
  constructor () {
    super()
    this.addBookmark = this.addBookmark.bind(this)
  }
  addBookmark () {
    const newBookmark = Immutable.fromJS({
      parentFolderId: this.props.selectedFolderId,
      tags: [siteTags.BOOKMARK]
    })
    aboutActions.showAddBookmark(newBookmark)
  }
  render () {
    return <div className='th-inner'>
      <span data-l10n-id={this.props.heading} />
      <span data-l10n-id='addBookmark' className='addBookmark' onClick={this.addBookmark} />
    </div>
  }
}

class BookmarkTitleCell extends ImmutableComponent {
  render () {
    let iconStyle
    let showingFavicon = false
    if (!siteUtil.isFolder(this.props.siteDetail)) {
      const icon = this.props.siteDetail.get('favicon')
      if (icon) {
        iconStyle = {
          minWidth: iconSize,
          width: iconSize,
          backgroundImage: `url(${icon})`,
          backgroundSize: iconSize,
          height: iconSize
        }
        showingFavicon = true
      }
    }

    const bookmarkTitle = this.props.siteDetail.get('customTitle') || this.props.siteDetail.get('title')
    const bookmarkLocation = this.props.siteDetail.get('location')

    return <div>
      {
        showingFavicon ? <span className='bookmarkFavicon' style={iconStyle} /> : null
      }
      <span>{bookmarkTitle || bookmarkLocation}</span>
      {
        bookmarkTitle ? <span className='bookmarkLocation'>{bookmarkLocation}</span> : null
      }
    </div>
  }
}

class BookmarksList extends ImmutableComponent {
  onDoubleClick (entry, e) {
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    aboutActions.newFrame({
      location: entry.location,
      partitionNumber: entry.partitionNumber
    })
  }
  /**
   * Called when a bookmark (or bookmarks) begin dragging.
   * If multiple items are selected, please note this method is
   * called by the onDragStart handler in sortableTable instead
   * of being directly bound to the table row being dragged.
   */
  onDragStart (siteDetail, e) {
    const isList = Immutable.List.isList(siteDetail)
    e.dataTransfer.effectAllowed = 'all'
    dndData.setupDataTransferBraveData(e.dataTransfer, dragTypes.BOOKMARK, siteDetail)
    // TODO: Pass the location here when content scripts are fixed
    dndData.setupDataTransferURL(e.dataTransfer, '', isList
      ? 'Multi-selection (' + siteDetail.size + ' bookmarks)'
      : siteDetail.get('customTitle') || siteDetail.get('title'))
  }
  /**
   * Bookmark entry is being dragged.
   */
  onDragOver (siteDetail, e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  /**
   * Move a folder, a bookmark, or multiple bookmarks IF move is allowed.
   * ex: won't allow child folder to become parent of an ancestor, etc.
   */
  moveBookmark (e, bookmark, siteDetail) {
    let destinationIsParent = false

    // If source is folder, destination needs to be a folder too
    if (siteUtil.isFolder(bookmark)) {
      siteDetail = siteDetail.get('parentFolderId')
        ? this.props.allBookmarkFolders.find((folder) => folder.get('folderId') === siteDetail.get('parentFolderId'))
        : Immutable.fromJS({folderId: 0, tags: [siteTags.BOOKMARK_FOLDER]})
      destinationIsParent = true
    }

    if (siteUtil.isMoveAllowed(this.props.allBookmarkFolders, bookmark, siteDetail)) {
      aboutActions.moveSite(bookmark.toJS(),
        siteDetail.toJS(),
        dndData.shouldPrependVerticalItem(e.target, e.clientY),
        destinationIsParent)
    }
  }
  /**
   * Bookmark (one or multiple) or BookmarkFolderItem object was dropped
   * onto `siteDetail` (which is a bookmark inside of sortableTable).
   */
  onDrop (siteDetail, e) {
    const bookmarkData = dndData.getDragData(e.dataTransfer, dragTypes.BOOKMARK)
    if (bookmarkData) {
      if (Immutable.List.isList(bookmarkData)) {
        bookmarkData.forEach((bookmark) => {
          this.moveBookmark(e, bookmark, siteDetail)
        })
        return
      }

      this.moveBookmark(e, bookmarkData, siteDetail)
    }
  }
  render () {
    const props = !this.props.draggable ? {
      onDragStart: this.onDragStart,
      sortingDisabled: !this.props.sortable
    } : {
      onDoubleClick: this.onDoubleClick,
      onDragStart: this.onDragStart,
      onDragOver: this.onDragOver,
      onDrop: this.onDrop,
      sortingDisabled: !this.props.sortable
    }
    return <div>
      <SortableTable
        headings={[
          <BookmarkTitleHeader heading='Title' selectedFolderId={this.props.selectedFolderId} />,
          'Last Visited'
        ]}
        defaultHeading='Title'
        rows={this.props.bookmarks.map((entry) => [
          {
            cell: <BookmarkTitleCell siteDetail={entry} />,
            value: entry.get('customTitle') || entry.get('title') || entry.get('location')
          },
          {
            html: new Date(entry.get('lastAccessedTime')).toLocaleString(),
            value: entry.get('lastAccessedTime')
          }
        ])}
        rowObjects={this.props.bookmarks}
        columnClassNames={['title', 'date']}
        addHoverClass
        multiSelect
        onDoubleClick={this.onDoubleClick}
        {...props}
        contextMenuName='bookmark'
        thisArg={this}
        onContextMenu={aboutActions.contextMenu} />
    </div>
  }
}

class AboutBookmarks extends React.Component {
  constructor () {
    super()
    this.onChangeSelectedFolder = this.onChangeSelectedFolder.bind(this)
    this.onChangeSearch = this.onChangeSearch.bind(this)
    this.onClearSearchText = this.onClearSearchText.bind(this)
    this.importBrowserData = this.importBrowserData.bind(this)
    this.addBookmarkFolder = this.addBookmarkFolder.bind(this)
    this.state = {
      bookmarks: Immutable.List(),
      bookmarkFolders: Immutable.Map(),
      selectedFolderId: 0,
      search: ''
    }
    ipc.on(messages.BOOKMARKS_UPDATED, (e, detail) => {
      this.setState({
        bookmarks: Immutable.fromJS(detail && detail.bookmarks || {}),
        bookmarkFolders: Immutable.fromJS(detail && detail.bookmarkFolders || {})
      })
    })
  }
  onChangeSelectedFolder (id) {
    this.setState({
      selectedFolderId: id,
      search: ''
    })
  }
  onChangeSearch (evt) {
    this.setState({
      search: evt.target.value
    })
  }
  onClearSearchText (evt) {
    this.setState({
      search: ''
    })
  }
  searchedBookmarks (searchTerm, bookmarks) {
    return bookmarks.filter((bookmark) => {
      const title = bookmark.get('customTitle') + bookmark.get('title') + bookmark.get('location')
      return title.match(new RegExp(searchTerm, 'gi'))
    })
  }
  get bookmarksInFolder () {
    return this.state.bookmarks.filter((bookmark) => (bookmark.get('parentFolderId') || 0) === this.state.selectedFolderId)
  }
  importBrowserData () {
    aboutActions.importBrowserDataNow()
  }
  addBookmarkFolder () {
    const newFolder = Immutable.fromJS({
      parentFolderId: this.state.selectedFolderId,
      tags: [siteTags.BOOKMARK_FOLDER]
    })
    aboutActions.showAddBookmarkFolder(newFolder)
  }
  componentDidMount () {
    this.refs.bookmarkSearch.focus()
  }
  render () {
    return <div className='siteDetailsPage'>
      <div className='siteDetailsPageHeader'>
        <div data-l10n-id='bookmarkManager' className='sectionTitle' />
        <div className='headerActions'>
          <div className='searchWrapper'>
            <input type='text' className='searchInput' ref='bookmarkSearch' id='bookmarkSearch' value={this.state.search} onChange={this.onChangeSearch} data-l10n-id='bookmarkSearch' />
            {
              this.state.search
              ? <span onClick={this.onClearSearchText} className='fa fa-close searchInputClear' />
              : <span className='fa fa-search searchInputPlaceholder' />
            }
          </div>
        </div>
      </div>

      <div className='siteDetailsPageContent'>
        <div className='folderView'>
          <div className='columnHeader'>
            <span data-l10n-id='folders' />
            <span data-l10n-id='importBrowserData' className='fa fa-download clearBrowsingDataButton' onClick={this.importBrowserData} />
            <span data-l10n-id='addBookmarkFolder' className='addBookmarkFolder' onClick={this.addBookmarkFolder} />
          </div>
          <BookmarkFolderList onChangeSelectedFolder={this.onChangeSelectedFolder}
            bookmarkFolders={this.state.bookmarkFolders.filter((bookmark) => bookmark.get('parentFolderId') === -1)}
            allBookmarkFolders={this.state.bookmarkFolders}
            isRoot
            selectedFolderId={this.state.selectedFolderId}
            search={this.state.search} />
        </div>
        <div className='organizeView'>
          <BookmarksList
            bookmarks={
              this.state.search
              ? this.searchedBookmarks(this.state.search, this.state.bookmarks)
              : this.bookmarksInFolder
            }
            allBookmarkFolders={this.state.bookmarkFolders}
            sortable={false}
            draggable={!this.state.search}
            selectedFolderId={this.state.selectedFolderId} />
        </div>
      </div>
    </div>
  }
}

module.exports = <AboutBookmarks />
