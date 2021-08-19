var path = require('path')

//source of photos
const origin_folder_small = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/tigapics_small'
const origin_folder_medium = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/tigapics_medium'
const origin_folder_default = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/tigapics'

//dir for removed files
const destination_folder_small = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/removed/tigapics_small'
const destination_folder_medium = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/removed/tigapics_medium'
const destination_folder_default = '/disk/newest/newest_backup/home/webuser/webapps/tigaserver/media/removed/tigapics'

//where to save JSONs with the information about photos removed, this files are very IMPORTANT and are REQUIRED TO UNDO THE MIGRATIONS
const metadata_dir = path.join(__dirname, '../removed_photos')

//where to save log file (files not found exceptions)
const logs = path.join(__dirname, '../../logs')

module.exports = { 
    origin_folder_small, 
    destination_folder_small,
    origin_folder_medium, 
    destination_folder_medium,
    origin_folder_default, 
    destination_folder_default,
    metadata_dir,
    logs
}