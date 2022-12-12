const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: "./autobot.js",
  output: {
    path: path.join(__dirname, "static"),
    filename: "app.bundle.js"
  },
  target: "node",
  externals: [nodeExternals()],
  externalsPresets: {
    node: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
    ]
  },
}