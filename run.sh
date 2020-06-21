#!/bin/bash
clear

echo "Removing node modules folder and installing latest"
#rm -rf node_modules
#rm package-lock.json
#ncu -u
npm install
npm audit fix
snyk test
