const prettierBytes = require('prettier-bytes')
const React = require('react')

class TorrentStats extends React.Component {
  render () {
    const torrent = this.props.torrent
    const errorMessage = this.props.errorMessage

    if (!torrent) {
      return null
    }

    if (errorMessage) {
      return <div className='error'>{errorMessage}</div>
    }

    return (
      <div className='torrentStats'>
        {renderPercentage()}
        {renderSpeeds()}
        {renderEta()}
        {renderTotalProgress()}
        {renderPeers()}
      </div>
    )

    function renderPercentage () {
      const percent = (torrent.progress < 1)
        ? (torrent.progress * 100).toFixed(1)
        : '100'
      return <span>{percent}%</span>
    }

    function renderTotalProgress () {
      const downloaded = prettierBytes(torrent.downloaded)
      const total = prettierBytes(torrent.length || 0)
      if (downloaded === total) {
        return (<span>{downloaded}</span>)
      } else {
        return (<span>{downloaded} / {total}</span>)
      }
    }

    function renderPeers () {
      if (torrent.numPeers === 0) return
      const count = torrent.numPeers === 1 ? 'peer' : 'peers'
      return (<span key='peers'>{torrent.numPeers} {count}</span>)
    }

    function renderSpeeds () {
      let str = ''
      if (torrent.downloadSpeed > 0) str += ' ↓ ' + prettierBytes(torrent.downloadSpeed) + '/s'
      if (torrent.uploadSpeed > 0) str += ' ↑ ' + prettierBytes(torrent.uploadSpeed) + '/s'
      if (str === '') return
      return (<span key='download'>{str}</span>)
    }

    function renderEta () {
      if (torrent.timeRemaining === Infinity) return // Zero download speed
      if (torrent.downloaded === torrent.length) return // Already done

      const rawEta = torrent.timeRemaining / 1000
      const hours = Math.floor(rawEta / 3600) % 24
      const minutes = Math.floor(rawEta / 60) % 60
      const seconds = Math.floor(rawEta % 60)

      // Only display hours and minutes if they are greater than 0 but always
      // display minutes if hours is being displayed
      const hoursStr = hours ? hours + 'h' : ''
      const minutesStr = (hours || minutes) ? minutes + 'm' : ''
      const secondsStr = seconds + 's'

      return (<span>{hoursStr} {minutesStr} {secondsStr} remaining</span>)
    }
  }
}

module.exports = TorrentStats
