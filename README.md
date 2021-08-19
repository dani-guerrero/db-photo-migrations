<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Thanks again! Now go create something AMAZING! :D
***
***
***
*** To avoid retyping too much info. Do a search and replace for the following:
*** dani-guerrero, db-photo-migrations, twitter_handle, email, db-photo-migrations, A tool to remove duplicate photos in tigaserver
-->



<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
<p align="center">
  <a href="https://github.com/dani-guerrero/db-photo-migrations">
  </a>

  <h3 align="center">db-photo-migrations</h3>

  <p align="center">
    A tool to ensure database-filesystem consistency and nonredundancy of photos in tigaserver
    <br />
</p>



<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary><h2 style="display: inline-block">Table of Contents</h2></summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#overview">Overview</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    <li>
      <a href="#configuration">Configuration</a>
    </li>
    </li>
    <li><a href="#usage">Usage</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

This project consists on the implementation of database data and file migrations using the [db-migrate](https://db-migrate.readthedocs.io/en/) node module. These migrations are aimed to ensure nonredundacy and consistency between files present in the database and those in the filesystem.
  

### Built With

* []() Node.js
##### Migrations are more appropiate in the context of creating, deleting and modifying schemas rather than data [des]integration, keep in mind that migrations must be deployed or undone sequentially. In case you ned to use it in a different way, consider reimplemting a script by using the photo-migration-lib implemented in this project.

## Overview

All the removed files (duplicates and orphans) will be moved from their source folders to new destinations folders defined in the configuration files.  
Finally, a JSON file for each migration (same name but json extension) will be saved into the metadata directory containing the list of all the photos removed. **It's very important to keep this files as they will be needed in order to undo the migration**  
Aditionally, it will save to a log file all the exceptions reporting not found files( it will look for the file identifiers in the folders for default, medium and small sizes, for instance, small sized are created on demand thus most exceptions can be ignored, however we should not expect exceptions for the default and medium sized folders (luckily, I haven't found any)). Content is always appendend to the log file so it won't disappear even if we undo the migrations.

### First Migration (files not found)
###### Time to complete: 1min 
The first migration identifies all the database photo records which file is not present in the filesystem and list them in the migration json file but does not delete the database records. The code for deletion and insertion is provided in the migration but commented.
### Second Migration (remove duplicates)
###### Time to complete: ~50min if comparing original images, ~20sec when comparing smalls. Change this by setting directly in the migration the argument you pass to function get_duplicates(db, folder)
  The second migration will find and move all the duplicated images present in the photos table.   
  The implementation satisfies 3 basic constraints:  
  * A photo marked as the best photo by reviewers will not be removed
  * Duplicates are only considered within the same report
  * All reports must remain with at least 1 photo (implicit)
   
The migration will  retrieve all the photos from the database and look for identic binary files within the permutations of all photos in each report, associating to each duplicated file the sha256 hash that will later help to identify these duplicates. The migration will finally query the database to remove all the candidates discarding those that would break any basic constraint defined above. It will finally try to move from the 3 source directories all these files to the folders defined in config file, potentially logging a lot of exceptions when looking into small sized folder.
### Third Migration (remove orphans)
###### Time to complete: 2min 
  The third migration consists on removing all the files that are not referenced from the photos table. Again, it will look for the files in the 3 folders just like the previous migration.

### Fourth Migration (files not found again )
###### Time to complete: 1min 
  It is exactly the same code as for the first migration, just run it in order to discard that anything has gone wrong in the meanwhile. A priori, we will expect to get the same number of not found files as in the first migration, (in case you have not uncomented the insert/delete provided there).

<hr>

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

* Use your package manager to install Node.js, for debian-based:
  ```sh
  apt install nodejs
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/dani-guerrero/db-photo-migrations.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```



<!-- USAGE EXAMPLES -->
## Configuration

* Configure db-migrate (database.json)
_For more info. please refer to the [Documentation](https://db-migrate.readthedocs.io/en/latest/Getting%20Started/configuration/)_  
* Configure your project (config.js)
<!-- USAGE EXAMPLES -->
## Usage
<hr>

### (Preferable)
### Deploy next migration 
With db-migrate globally installed:  
```sh
db-migrate.sh up -c 1
```
Otherwise (locally installed):  
```sh
./db-migrate.sh up -c 1
```

### Undo previous migration
```sh
./db-migrate.sh down -c 1
```
<hr >

### (DON'T DO THIS!!!!!) 
### Deploy all migrations 
```sh
./db-migrate.sh up
```
### Undo all migrations

```sh
./db-migrate.sh reset
```

<hr>

### Create new migration
```sh
./db-migrate.sh create migration-name [options]
```
