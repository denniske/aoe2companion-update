import {$} from "bun";
import fs from "fs/promises";
import {execSync} from "child_process";

async function main() {
    // const result = await $`echo 'test'`.text();

    // const result = await $`ls -al`.text();
    // const result = await $`echo "Hello World!" | wc -w`.text();

    // console.log('RESULT:');
    // console.log(result); // 2\n

    //
    // await $`node ./update/export-expo-config.js > dist/expoConfig.json`
    //     .cwd("../aoe2companion");

    // const config = await $`cat dist/expoConfig.json`
    //     .cwd("../aoe2companion")
    //     .json();

    // await $`cp -r ../aoe2companion/dist/. updates/$directory`;
















    // const config = await $`node ./update/export-expo-config.js`
    //     .cwd("../aoe2companion")
    //     .json();
    //
    // const directory = `${config.runtimeVersion}/${config.version}`;
    //
    // console.log('DIRECTORY:', directory);
    //
    // await $`npx expo export -p ios -p android -s`
    //     .cwd("../aoe2companion");
    //
    // await fs.rmdir(`updates/${directory}`);
    // await fs.mkdir(`updates/${directory}`);
    //
    // await fs.cp('../aoe2companion/dist', `updates/${directory}`, {recursive: true});
    // await fs.writeFile(`updates/${directory}/expoConfig.json`, JSON.stringify(config));





    // const config = await $.cwd("../aoe2companion")`node ./update/export-expo-config.js`.json();
    // const directory = `${config.runtimeVersion}/${config.version}`;
    // console.log('DIRECTORY:', directory);
    //
    // await $.cwd("../aoe2companion")`npx expo export -p ios -p android -s`;
    //
    // await fs.rmdir(`updates/${directory}`);
    // await fs.mkdir(`updates/${directory}`);
    //
    // await fs.cp('../aoe2companion/dist', `updates/${directory}`, {recursive: true});
    // await fs.writeFile(`updates/${directory}/expoConfig.json`, JSON.stringify(config));


    const config2 = execSync('node ./update/export-expo-config.js', { cwd: '../aoe2companion'}).toString();
    console.log('CONFIG2:', config2);

    execSync('npx expo export -p ios -p android -s', { stdio: 'inherit', cwd: '../aoe2companion'});

    // const scriptDirectory = await $`pwd`.text();
    //
    // $.cwd("../aoe2companion");
    //
    // const config = await $`node ./update/export-expo-config.js`.json();
    // const directory = `${config.runtimeVersion}/${config.version}`;
    // console.log('DIRECTORY:', directory);
    //
    // await $`npx expo export -p ios -p android -s`;
    //
    // $.cwd(scriptDirectory);
    //
    // await fs.rmdir(`updates/${directory}`);
    // await fs.mkdir(`updates/${directory}`);
    //
    // await fs.cp('../aoe2companion/dist', `updates/${directory}`, {recursive: true});
    // await fs.writeFile(`updates/${directory}/expoConfig.json`, JSON.stringify(config));

























    // const { stdout, stderr, exitCode } = await $`echo "Hello World!"`.quiet();
    // const { stdout, stderr, exitCode } = await $`ls`.quiet();
    //
    // console.log('OUT:');
    // console.log(stdout.toString()); // Buffer(6) [ 72, 101, 108, 108, 111, 32 ]
    // console.log('ERROR:');
    // console.log(stderr.toString()); // Buffer(0) []
    // console.log('EXIT CODE: ', exitCode); // 0
}

main();

// const response = await fetch("https://example.com");
//
// // Use Response as stdin.
// await $`echo < ${response} > wc -c`; // 120
//
//
//
// import { $, file } from "bun";
//
// const response = new Response("hello i am a response body");
//
// const result = await $`cat < ${response}`.text();
//
// console.log(result); // hello i am a response body
