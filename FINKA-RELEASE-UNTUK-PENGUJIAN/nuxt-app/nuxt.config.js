export default {
  srcDir: '.',
  buildDir: process.env.NODE_ENV === 'production' ? '.nuxt' : '.nuxt-dev',
  app: {
    head: {
      title: 'Finka',
      htmlAttrs: { lang: 'id' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css'],
  plugins: [
    '~/plugins/store.js',
    '~/plugins/api-config.js',
    '~/plugins/api-inject.js',
    '~/plugins/format.js',
    '~/plugins/clock.js',
    '~/plugins/auth-init.client.js'
  ],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api'
    }
  },
  devServer: {
    host: 'localhost'
  },
  components: true,
  experimental: {
    componentIslands: false
  },
  vue: {
    compilerOptions: {
      compatConfig: { MODE: 2 }
    }
  },
  vite: {
    resolve: {
      alias: [{ find: /^vue$/, replacement: '@vue/compat' }]
    },
    vue: {
      template: {
        compilerOptions: {
          compatConfig: { MODE: 2 }
        }
      }
    }
  },
  build: {
    transpile: ['fast-png', 'iobuffer']
  }
}
