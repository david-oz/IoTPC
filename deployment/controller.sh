#!/bin/bash

cd ..
git fetch
git reset --hard origin/develop
cd deployment

#node '../Setup/Setup.js'

bash deploy.sh IoT
bash deploy.sh Distributor
bash deploy.sh Vendor

