const path = require("path");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = {
  entry: "./src/bootstrap.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "src/build"),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [new MonacoWebpackPlugin()],
  target: "electron-renderer",
};
