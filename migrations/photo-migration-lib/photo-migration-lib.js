'use strict';
var path = require('path')
var fs = require('fs')
const {exec} = require('child_process')

var config = require('../config/config')

//I have to implement my own runSql bcause node-pg is not able to handle such big queries
//Note that (for SELECT) it will only work as long as this runs on the same machine where db server is (because it uses an intermediary file for the output)
function run_big_query(query, callback, type='select'){
  let db_filePath = path.join(__dirname,'./../../database.json')
  let db_config = JSON.parse(fs.readFileSync(db_filePath, { encoding: 'utf-8' }))
  db_config  = db_config.prod

  let query_filePath = path.join(__dirname,'./../../query.sql')
  let query_output_filePath= '/tmp/query_output.json'
  if (type=='select')
    query = `COPY (SELECT JSON_AGG(ROW_TO_JSON(ROW)) FROM (${query}) AS ROW) TO '${query_output_filePath}'`

  fs.writeFile(query_filePath, query, { flag: 'w+' }, () => { 
   return exec(`export PGPASSWORD=${db_config.password} && 
      psql -d ${db_config.database} -h ${db_config.host} -p ${db_config.port} -U ${db_config.user} -f '${query_filePath}'`, (error, stdout, stderr) => {
        if (error) log(error)
        exec('unset PGPASSWORD') //CAUTION! Nobody else is using this ENV?
        if(type == 'select')
          callback(JSON.parse(fs.readFileSync(query_output_filePath, { encoding: 'utf-8' })))
        else 
          callback(stdout)
    })
  })
}

//write to logfile
function log(info) {
  let tagged_info = `${Date()} ${info}\n`
  fs.writeFile(config.logs, tagged_info, { flag: 'a+' }, () => { })
}

//returns (true) if 2 buffers are considered different
function diff(binaryA, binaryB) {
  return !binaryA.equals(binaryB)
}

//input & output format: [reportA: [{id:"1", photo_id:"abc", report_id:"abc"},{id:"2", ...}], reportB: [...]]
//returns all the files (including their sha256) that are found duplicated, and with a lot of redundacy that is later solved in a SELECT DISTINCT, just for speeding up
function get_duplicates(json_data, origin_folder) {
  let groupedJson = group_by_report_id(json_data)
  let duplicates = []

  for (let report in groupedJson) {
    let files = groupedJson[report]
    let numfiles = files.length
    for (let i = 0; i < numfiles; i++) {
      let filenameA = files[i].photo;
      let pathA = path.join(origin_folder, filenameA)
      let binaryA;
      try {
        binaryA = fs.readFileSync(pathA, { encoding: null })//it will throw an error if file is not present!!
        for (let j = i + 1; j < numfiles; j++) {
          let filenameB = files[j].photo;
          if (filenameB != filenameA) {
            let pathB = path.join(origin_folder, filenameB)
            let binaryB;
            try {
              binaryB = fs.readFileSync(pathB, { encoding: null })
              if (!diff(binaryB, binaryA)) { //they are equal
                //add the digest of the file so we can later easily compare them inside DB queries
                const {createHash } = require('crypto')
                const hash = createHash('sha256').update(binaryB).digest('base64');

                //if the record has already been created 
                if (duplicates[report]) {
                  duplicates[report].push({...files[i], hash:hash}) //fileA
                  duplicates[report].push({...files[j], hash:hash}) //fileB
                }
                else duplicates[report] = [{ ...files[i],hash:hash }, { ...files[j],hash:hash }]
              }
            } catch (err) { log(err) } //capture filenotfound
          }
        }
      } catch (err) { log(err) } //capture filenotfound
    }
  }
  return ungroup(duplicates)
}
//input: [{report_id: "report1", photo_id:"photo1" }, {report_id: "report1", photo_id: "photo2"}, {report_id: "report2, photo_id:"photo2""}]
//output: [report1: [{report_id: "report1", photo_id:"photo1" }, {report_id: "report1", photo_id: "photo2"}], report2: [{report_id: report2, ...}]]
//grouping it simplifies then iterating through reports
function group_by_report_id(json_data) {
  //reducer, vars stand for accumulator and current value
  return json_data.rows.reduce(function (acc, cv) {
    let found = acc[cv.report_id]
    if (!found)
      acc[cv.report_id] = [cv]
    else acc[cv.report_id].push(cv)
    return acc
  }, {})
}

//flatten a grouped json, same format that is retrieved from db
function ungroup(groupedData) {
 let flattened = Array.from(Object.values(groupedData)).reduce((acc, cv) => acc.concat(cv, []))
  return flattened
}


function get_query_best_photo_ids() {
  return `SELECT report_id, best_photo_id as id FROM tigacrafting_expertreportannotation`
}

//recieves all candidates, it discards those marked as best_photo and returns all report duplicates leaving 1 of each (greatest id)
function get_photos_to_remove(db, json_data, callback) {

  //"push" the json into the query removing all the duplicates, which was not done before because it might be faster inside the db than in node
  let candidates_query = 
    `SELECT DISTINCT column1 AS photo_id, column2 AS report_id, column3 AS hash, column4 as photo, column5 as hide, column6 as uuid
      FROM (VALUES ${json_data.map(entry => 
        `(${entry.id},'${entry.report_id}','${entry.hash}','${entry.photo}','${entry.hide}','${entry.uuid}')`)}) 
      AS candidates`

  db.runSql(candidates_query).then(unique_candidates_result => {
    let unique_candidates = unique_candidates_result.rows
    let unique_candidates_query =
      `SELECT column1 AS photo_id, column2 AS report_id, column3 AS hash, column4 as photo, column5 as hide, column6 as uuid
      FROM (VALUES ${unique_candidates.map(entry => 
        `(${entry.photo_id},'${entry.report_id}','${entry.hash}','${entry.photo}','${entry.hide}','${entry.uuid}')`)})
      AS candidates`

    //candidates not marked as best_photo in a report
    let candidates_not_best =
      `${unique_candidates_query} LEFT JOIN (${get_query_best_photo_ids()}) AS best ON column1 = best.id WHERE best.id IS NULL`

    //candidates marked as best_photo in a report, we don't wont to erase them
    let candidates_best =
      `${unique_candidates_query} INNER JOIN (${get_query_best_photo_ids()}) AS best ON column1 = best.id`

    //select only the hashes for the next IN clause
    let candidates_best_hash =
      `SELECT hash FROM (${candidates_best}) AS best_hashes`

    //we pardon distinct hashes(grouped max photo_id) on each report as long as they are not already excluded by being the best photo
    let pardoned_candidates =
      `SELECT report_id, MAX(photo_id) as photo_id, hash FROM (${candidates_not_best}) AS pardoned_candidates
        WHERE hash NOT IN (${candidates_best_hash})
        GROUP BY report_id, hash`

    //select only the photo id's for the next IN clause
    let pardoned_candidates_ids =
      `SELECT photo_id FROM (${pardoned_candidates}) AS pardoned_ids`

    //we sentence every candidate not pardoned nor marked as best photo
    let sentenced_candidates =
      `SELECT sentenced_candidates.report_id, sentenced_candidates.photo_id as id, photo, uuid, hide
      FROM (${candidates_not_best}) AS sentenced_candidates WHERE sentenced_candidates.photo_id NOT IN (${pardoned_candidates_ids})`

    run_big_query(sentenced_candidates,callback)
  })
}

function move_files(json_data, origin_folder, destination_folder){
  json_data.forEach(obj => {
    let filename = obj.photo
    let pathA= path.join(origin_folder, filename)
    let pathB= path.join(destination_folder, filename)
    fs.rename(pathA, pathB, function(err){if(err) log(err)})
  })
}
//it recieves the output from a query (for instance, get_photos_to_remove's output)
// return the result of the delete query of all the id's present in the input data.
function delete_photos(db, json_data) {
  let values =
    `${json_data.map(entry => `(${entry.id})`)}`

  let delete_query =
    `DELETE FROM tigaserver_app_photo WHERE id IN (VALUES ${values});`

  // return db.runSql(delete_query);
  run_big_query(delete_query,()=>{}, 'delete')
}

function get_all_photos(db) {
  return db.runSql(
    `SELECT  id, photo, report_id, uuid, hide
    FROM public.tigaserver_app_photo;`
  );
}

function insert_photos(db, json_data){
  let insert_query = 
  `INSERT INTO public.tigaserver_app_photo (id, photo, uuid, hide, report_id) 
      (VALUES ${json_data.map(entry => 
        `(${entry.id},'${entry.photo}','${entry.uuid}','${entry.hide}','${entry.report_id}')`)})` 

  let callback = () => {}
  run_big_query(insert_query, callback, 'insert')
}

// precondition: folders must exist and have to sum at least 1 file
function get_files_not_found(db, folders=[], callback) {
  let files = []
  folders.forEach( folder =>{
    files = files.concat(fs.readdirSync(folder))
  })

  let query = 
    `SELECT id, photo, report_id, uuid, hide FROM tigaserver_app_photo
      WHERE photo NOT IN (VALUES ${files.map(f => `('tigapics/${f}')`)})`

  run_big_query(query, callback)
}

function get_orphans(db, origin_folder, callback) {

  return fs.readdir(origin_folder, (err, files) => {
    let query = 
	    `SELECT column1 as photo from (VALUES ${files.map(filename => `('tigapics/${filename}')`)}) AS FILES
	      WHERE column1 NOT IN (SELECT photo FROM tigaserver_app_photo)`

    run_big_query(query, callback)
  })
}

module.exports = {
	get_duplicates,
	get_photos_to_remove,
	get_all_photos,
	delete_photos,
	insert_photos,
	get_orphans,
	move_files,
  get_files_not_found
}
