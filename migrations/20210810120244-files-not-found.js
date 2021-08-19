'use strict';
var path = require('path')
var fs = require('fs')
const config = require('./config/config')

// const origin_folder_small = config.origin_folder_small
const origin_folder_medium = config.origin_folder_medium
const origin_folder_default= config.origin_folder_default

const{ 
  delete_photos,
  insert_photos,
  get_files_not_found
} = require('./photo-migration-lib/photo-migration-lib')

//Name of the current migration file with .json extension
function json_filename(){
  let db_config = fs.readFile
  return path.basename(__filename).replace('.js','.json')
}

var filePath = path.join(config.metadata_dir, json_filename())  // file to store relation of removed photos

function create_metadata_dir(){
  if (!fs.existsSync(config.metadata_dir)) fs.mkdirSync(config.metadata_dir, {recursive: true})
}

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  create_metadata_dir()
  let callback = (json_results) => { 
    fs.writeFile(filePath, JSON.stringify(json_results, null,2), { flag: 'w+' }, err => {
      if (err)
        console.log(err)
      else console.log(`All ${json_results.length} not found photos can be found in`, filePath)
    })
    // delete_photos(db, json_results) //if you uncomment here, uncomment also the insert in down function
  }
  //folders where files will be searched
  let folders = [origin_folder_default, origin_folder_medium]

  get_files_not_found(db, folders, callback)

  return null;
};

exports.down = function(db) {
  fs.readFile(filePath, { encoding: 'utf-8' }, (err, json_string) => {
    let json_data = JSON.parse(json_string)
    // insert_photos(db, json_data)
    console.log(`All ${json_data.length} not found photos are still lost`)
  })

  return null;
};

exports._meta = {
  "version": 1
};
