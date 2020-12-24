#!/bin/bash
clear

echo "Installing latest"
rm -rf node_modules
rm package-lock.json
ncu -u
npm install
