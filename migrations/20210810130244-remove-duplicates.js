'use strict';
var path = require('path')
var fs = require('fs')

var config = require('./config/config')

const origin_folder_small = config.origin_folder_small
const destination_folder_small = config.destination_folder_small
const origin_folder_medium = config.origin_folder_medium
const destination_folder_medium = config.destination_folder_medium
const origin_folder_default= config.origin_folder_default
const destination_folder_default= config.destination_folder_default


const{ 
  get_duplicates,
  get_photos_to_remove,
  get_all_photos,
  move_files,
  insert_photos,
  delete_photos
} = require('./photo-migration-lib/photo-migration-lib')

//Name of the current migration file with .json extension
function json_filename(){
  let db_config = fs.readFile
  return path.basename(__filename).replace('.js','.json')
}

var filePath = path.join(config.metadata_dir, json_filename())  // file to store relation of removed photos

function createDestinationDirs(){
  if (!fs.existsSync(destination_folder_small)) fs.mkdirSync(destination_folder_small, {recursive: true})
  if (!fs.existsSync(destination_folder_medium)) fs.mkdirSync(destination_folder_medium, {recursive: true})
  if (!fs.existsSync(destination_folder_default)) fs.mkdirSync(destination_folder_default, {recursive: true})
}

//db-migrate code starts here
var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  createDestinationDirs(); 
  get_all_photos(db).then( results => {
    //remove prefix tigapics/ from photo paths
    results = JSON.parse(JSON.stringify(results).split('tigapics/').join(''))
    let duplicates = get_duplicates(results, origin_folder_small)

    //function that will be applied to the duplicated photos
    //save list to a json file, then delete db records + move files
    let callback = (json_results) =>{
      fs.writeFile(filePath, JSON.stringify(json_results, null, 2), { flag: 'w+' }, err => {
        if (err)
          console.log(err)
        else console.log(`All ${json_results.length} deleted photos can be found in`, filePath)
      })
      delete_photos(db, json_results)
      move_files(json_results, origin_folder_small, destination_folder_small)
      move_files(json_results, origin_folder_medium, destination_folder_medium)
      move_files(json_results, origin_folder_default, destination_folder_default)
    }

    get_photos_to_remove(db, duplicates, callback)
  })
  return null
};

exports.down = function (db) {
  fs.readFile(filePath, { encoding: 'utf-8' }, (err, json_string) => {
    let json_data = JSON.parse(json_string)

    //set prefix tigapics/ to photo paths before inserting into db
    insert_photos(db, json_data.map(obj => { return {...obj, photo: 'tigapics/' + obj.photo}}))

    move_files(json_data, destination_folder_default, origin_folder_default)
    move_files(json_data, destination_folder_medium, origin_folder_medium)
    move_files(json_data, destination_folder_small, origin_folder_small)

    console.log(`All ${json_data.length} previously removed duplicates have been restablished`)
  })
  return null;
};

exports._meta = {
  "version": 1
};