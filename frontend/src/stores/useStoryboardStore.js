import { create } from 'zustand'
import api from '../services/api'

const useStoryboardStore = create((set, get) => ({
  scenes: [],
  selectedSceneId: null,
  loading: false,
  regenerating: null, // scene ID currently regenerating

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

  // Update a scene's editable fields (title, description, location, etc.)
  updateScene: async (sceneId, fields) => {
    try {
      const { data } = await api.put(`/api/scenes/${sceneId}`, fields)
      set((s) => ({
        scenes: s.scenes.map((sc) => (sc.id === sceneId ? data : sc)),
      }))
      return data
    } catch {
      return null
    }
  },

  // Add a new scene
  addScene: async (scriptId) => {
    try {
      const { data } = await api.post(`/api/scenes/script/${scriptId}`, {
        title: 'New Scene',
      })
      set((s) => ({ scenes: [...s.scenes, data] }))
      return data
    } catch {
      return null
    }
  },

  // Delete a scene
  deleteScene: async (sceneId) => {
    try {
      await api.delete(`/api/scenes/${sceneId}`)
      set((s) => ({
        scenes: s.scenes.filter((sc) => sc.id !== sceneId),
        selectedSceneId: s.selectedSceneId === sceneId ? null : s.selectedSceneId,
      }))
      return true
    } catch {
      return false
    }
  },

  // Regenerate a scene (LLM + SD)
  regenerateScene: async (sceneId) => {
    set({ regenerating: sceneId })
    try {
      const { data } = await api.post(`/api/scenes/${sceneId}/regenerate`)
      set((s) => ({
        scenes: s.scenes.map((sc) => (sc.id === sceneId ? data : sc)),
        regenerating: null,
      }))
      return data
    } catch {
      set({ regenerating: null })
      return null
    }
  },

  // Regenerate only the frame for a scene
  regenerateFrame: async (sceneId) => {
    set({ regenerating: sceneId })
    try {
      const { data } = await api.post(`/api/scenes/${sceneId}/regenerate-frame`)
      set((s) => ({
        scenes: s.scenes.map((sc) => (sc.id === sceneId ? data : sc)),
        regenerating: null,
      }))
      return data
    } catch {
      set({ regenerating: null })
      return null
    }
  },

  // Update a shot's SD prompt
  updateShotPrompt: async (shotId, sdPrompt) => {
    try {
      await api.put(`/api/scenes/shot/${shotId}/prompt`, { sd_prompt: sdPrompt })
      // Update the prompt in local state
      set((s) => ({
        scenes: s.scenes.map((sc) => ({
          ...sc,
          shots: sc.shots.map((sh) =>
            sh.id === shotId ? { ...sh, sd_prompt: sdPrompt } : sh,
          ),
        })),
      }))
      return true
    } catch {
      return false
    }
  },
}))

export default useStoryboardStore
