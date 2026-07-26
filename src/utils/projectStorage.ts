import { isDesktopApp } from '../runtime'
import * as desktop from './projectStorageDesktop'
import * as idb from './projectStorageIdb'
import type { ProjectSnapshot, SavedProjectMeta } from './projectStorageTypes'

export type { ProjectSnapshot, SavedProjectMeta }

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
