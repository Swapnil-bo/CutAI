import { create } from 'zustand'
import api from '../services/api'

const useStoryboardStore = create((set, get) => ({
  scenes: [],
  selectedSceneId: null,
  loading: false,

  // Load scenes for a script from the API
  loadScenes: async (scriptId) => {
    set({ loading: true })
    try {
      const { data } = await api.get(`/api/scenes/script/${scriptId}`)
      set({ scenes: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  // Load scenes from storyboard export (by project ID)
  loadFromProject: async (projectId) => {
    set({ loading: true })
    try {
      const { data } = await api.get(`/api/storyboard/${projectId}/export`)
      const scripts = data.scripts || []
      // Flatten all scenes from all scripts (typically just one)
      const allScenes = scripts.flatMap((s) => s.scenes || [])
      set({ scenes: allScenes, loading: false })
    } catch {
      set({ scenes: [], loading: false })
    }
  },

  setScenes: (scenes) => set({ scenes }),

  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

  // Reorder scenes locally and persist to API
  reorderScenes: async (scriptId, newOrder) => {
    set({ scenes: newOrder })
    try {
      await api.put(`/api/scenes/reorder/${scriptId}`, {
        scene_ids: newOrder.map((s) => s.id),
      })
    } catch {
      // revert could go here
    }
  },
}))

export default useStoryboardStore
