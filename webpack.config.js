var webpack = require('webpack')

module.exports = {
  contentBase: './dist/',
  cache: true,
  inline: true,
  target: 'atom',
  entry: {
    app: ['webpack/hot/dev-server', './js/entry.js']
  },
  devtool: '#source-map',
  output: {
    path: './public/built',
    filename: 'bundle.js',
    publicPath: 'http://localhost:8080/built/',
    sourceMapFilename: '[file].map',
    stats: { colors: true }
  },
  module: {
    noParse: [],
    loaders: [
      {
        test: /\.js?$/,
        exclude: [
          /node_modules/,
          /bower_components/,
          /\.min.js$/
        ],
        loader: 'babel',
        query: {
          presets: ['react', 'es2015']
        }
      },
      {
        test: /\.less$/,
        loader: 'style-loader!css-loader!less-loader'
      },
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      // Loads font files for Font Awesome
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader?limit=10000&minetype=application/font-woff'
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'file-loader'
      }
    ]
  },
  resolve: {
    alias: {
      // The with-addons is only needed for perseus :(
      // example: 'react': path.resolve('node_modules/react/dist/react-with-addons.js'),
    },
    extensions: ['', '.js', '.jsx']
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  devServer: {
    contentBase: './public',
    publicPath: 'http://localhost:8080/built/'
  }
}

