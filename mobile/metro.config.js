const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Allow Metro to see files outside the mobile/ project root
config.watchFolders = [workspaceRoot]

// Resolve @shared/* to the shared/ directory
config.resolver.extraNodeModules = {
  '@shared': path.resolve(workspaceRoot, 'shared'),
}

module.exports = config
