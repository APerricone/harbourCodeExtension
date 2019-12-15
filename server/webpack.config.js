//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', 
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'hb_server.js'
  },
  node: {
    __dirname: false
  },
  plugins: [
    new CopyPlugin([
      {from: "src/hbdocs.*", flatten: true}
    ])
  ]
};
module.exports = config;