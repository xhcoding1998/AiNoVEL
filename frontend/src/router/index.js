import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    component: () => import('../components/layout/AppLayout.vue'),
    meta: { auth: true },
    children: [
      {
        path: '',
        redirect: '/projects'
      },
      {
        path: 'projects',
        name: 'ProjectList',
        component: () => import('../views/ProjectList.vue')
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('../views/ProjectDetail.vue'),
        children: [
          {
            path: '',
            redirect: to => ({ name: 'BasicInfo', params: { id: to.params.id } })
          },
          {
            path: 'basic-info',
            name: 'BasicInfo',
            component: () => import('../components/novel/BasicInfo.vue')
          },
          {
            path: 'world-building',
            name: 'WorldBuilding',
            component: () => import('../components/novel/WorldBuild.vue')
          },
          {
            path: 'characters',
            name: 'Characters',
            component: () => import('../components/novel/CharacterEditor.vue')
          },
          {
            path: 'relations',
            name: 'Relations',
            component: () => import('../components/novel/RelationGraph.vue')
          },
          {
            path: 'plot',
            name: 'PlotControl',
            component: () => import('../components/novel/PlotControl.vue')
          },
          {
            path: 'chapters',
            name: 'Chapters',
            component: () => import('../components/novel/ChapterEditor.vue')
          },
          {
            path: 'style',
            name: 'StyleControl',
            component: () => import('../components/novel/StyleControl.vue')
          },
          {
            path: 'ai-tasks',
            name: 'AITasks',
            component: () => import('../views/AITasks.vue')
          }
        ]
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.auth && !auth.isAuthenticated) {
    next({ name: 'Login' })
  } else if (to.meta.guest && auth.isAuthenticated) {
    next('/projects')
  } else {
    next()
  }
})

export default router
