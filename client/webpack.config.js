//@ts-check

'use strict';

const path = require('path');

const config = {
  target: 'node',
  entry: {
    "extension": './src/extension.js',
    "debugger": './src/debugger.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      '@yagisumi/win-output-debug-string': path.join(__dirname,'node_modules/@yagisumi/win-output-debug-string/build/Release/win_output_debug_string.node')
    }
  },
  module: {
    rules: [
      {test: /\.node$/, use: 'node-loader'},
      {
        test: /\.js$/,
        exclude: /node_modules/
      }
    ]
  },
  node: {
    __dirname: false
  }
};
module.exports = config;
