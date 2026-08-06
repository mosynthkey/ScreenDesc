import { isDesktopApp } from '../runtime'
import * as desktop from './projectStorageDesktop'
import * as idb from './projectStorageIdb'
import type { ProjectFolder, ProjectSnapshot, SavedProjectMeta } from './projectStorageTypes'

export type { ProjectFolder, ProjectSnapshot, SavedProjectMeta }

const backend = isDesktopApp ? desktop : idb

export const saveProject = backend.saveProject
export const loadProject = backend.loadProject
export const clearAutosavedProject = backend.clearAutosavedProject
export const saveNamedProject = backend.saveNamedProject
export const patchSavedProjectMeta = backend.patchSavedProjectMeta
export const listSavedProjects = backend.listSavedProjects
export const loadNamedProject = backend.loadNamedProject
export const loadAllNamedProjects = backend.loadAllNamedProjects
export const loadNamedProjectImageBlob = backend.loadNamedProjectImageBlob
export const loadNamedProjectThumbnail = backend.loadNamedProjectThumbnail
export const renameNamedProject = backend.renameNamedProject
export const deleteNamedProject = backend.deleteNamedProject
export const revealNamedProject = backend.revealNamedProject
export const listProjectFolders = backend.listProjectFolders
export const createProjectFolder = backend.createProjectFolder
export const updateProjectFolder = backend.updateProjectFolder
export const deleteProjectFolder = backend.deleteProjectFolder
export const moveNamedProject = backend.moveNamedProject
export const moveProjectFolder = backend.moveProjectFolder
