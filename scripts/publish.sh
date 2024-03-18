
runtimeVersion=$(cd ../aoe2companion && node ./update/export-expo-config-runtime-version.js)
version=$(cd ../aoe2companion && node ./update/export-expo-config-version.js)
directory="$runtimeVersion/$version"

echo $directory

rm -rf updates/$directory/
mkdir -p updates/$directory/

# added --dump-assetmap for use with npx expo-updates assets:verify -a dist/assetmap.json -e dist/metadata.json -b manifest.json -p ios
(cd ../aoe2companion && npx expo export -p ios -p android -s --dump-assetmap)
(cd ../aoe2companion && node ./update/export-expo-config.js > dist/expoConfig.json)

cp -r ../aoe2companion/dist/. updates/$directory




















































#s3cmd -c .s3cfg \
#       --access_key $EXPO_UPDATE_SPACE_ACCESS_KEY \
#       --secret_key $EXPO_UPDATE_SPACE_SECRET_KEY \
#       put updates/$directory s3://aoe2companion-update/$runtimeVersion/ --acl-public --add-header=Cache-Control:max-age=86400 --recursive
#
#touch $currentDate
#
#s3cmd -c .s3cfg \
#       --access_key $EXPO_UPDATE_SPACE_ACCESS_KEY \
#       --secret_key $EXPO_UPDATE_SPACE_SECRET_KEY \
#       put $currentDate s3://aoe2companion-update/index/$runtimeVersion/ --acl-public --add-header=Cache-Control:max-age=86400 --recursive
#
#rm $currentDate
























#doppler run -c dev_aoe2 --command 's3cmd -c .s3cfg \
#                                         --access_key $EXPO_UPDATE_SPACE_ACCESS_KEY \
#                                         --secret_key $EXPO_UPDATE_SPACE_SECRET_KEY \
#                                         put updates/$directory s3://aoe2companion-update/ \
#                                             --acl-public \
#                                             --add-header=Cache-Control:max-age=86400 \
#                                             --recursive \
#                                             --dry-run'

#runtimeVersion=$(cd ../aoe2companion && node ./update/export-expo-config.js | jq -r '.runtimeVersion')
#directory="$runtimeVersion/$(date +%s)"
#
#echo $directory
#
#rm -rf updates/$directory/
#mkdir -p updates/$directory/
#
#(cd ../aoe2companion && npx expo export -p android)
#(cd ../aoe2companion && node ./update/export-expo-config.js > dist/expoConfig.json)
#
#cp -r ../aoe2companion/dist/. updates/$directory
#
#(cd ../aoe2companion && npx expo export -p ios)
#(cd ../aoe2companion && node ./update/export-expo-config.js > dist/expoConfig.json)
#
#cp -r ../aoe2companion/dist/. updates/$directory
#
#git add --all updates/$directory
#git commit -m "update"
#git push

