const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProdBuild = process.env.NODE_ENV === 'production';

module.exports = {
  entry: isProdBuild ? './Src/index.ts' : './src/dev.ts',
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.(grammar|terms|terms\.js)$/,
        use: require.resolve('./lezer-loader.cjs'),
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '../dist'),
    library: {
      type: 'module',
    },
  },
  ...(isProdBuild
    ? {}
    : {
        devtool: 'source-map',
        mode: 'development',
        devServer: {
          static: './dist',
          hot: false,
        },
      }),

  plugins: isProdBuild
    ? []
    : [
        new HtmlWebpackPlugin({
          template: 'dev/index.html',
          title: 'Development',
        }),
      ],
};
