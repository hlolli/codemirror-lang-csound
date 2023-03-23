const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProdBuild = process.env.NODE_ENV === 'production';

module.exports = {
  entry: isProdBuild ? './src/index.ts' : './src/dev.ts',
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
        test: !isProdBuild
          ? /\.tsx?$/
          : function (modulePath) {
              return (
                modulePath.endsWith('.ts') && !modulePath.endsWith('dev.ts')
              );
            },
        use: 'ts-loader',
        exclude: isProdBuild ? /node_modules|dev\.ts/ : /node_modules/,
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
  // externals: {
  //   '@lezer/common': '@lezer/common/dist/index.cjs',
  //   codemirror: 'codemirror',
  //   '@codemirror/commands': '@codemirror/commands/dist/index.cjs',
  //   '@codemirror/search': '@codemirror/search/dist/index.cjs',
  //   '@codemirror/language': '@codemirror/language/dist/index.cjs',
  //   '@codemirror/autocomplete': '@codemirror/autocomplete/dist/index.cjs',
  //   '@codemirror/view': '@codemirror/view/dist/index.cjs',
  //   '@codemirror/state': '@codemirror/state/dist/index.cjs',
  // },
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
