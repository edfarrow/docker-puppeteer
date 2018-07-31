"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const url = require("url");

const minerva = require("commander");
const puppeteer = require("puppeteer");

var uriArg = null;
var outputArg = null;
var isURL = false;

if (!process.defaultApp) {
    process.argv.unshift("--");
}

var args = process.argv.slice(2);
var src = path.resolve(path.join(__dirname, "/minerva.js"));
args.unshift(src);

minerva
    .version("1.0.0")
    .description("convert HTML to PNG via stdin or a local / remote URI")
    .option("-T, --timeout <seconds>", "seconds before timing out (default: 120)", parseInt)
	.option("-S, --stdout", "write conversion to stdout")
	.option("-D, --debug", "debug mode")
    .option("--no-cache", "disables caching")
    .arguments("<string> [output]")
    .action((uri, output) => {
        uriArg = uri;
        outputArg = output;
    })
    .parse(args);

// Display help information by default
if (!process.argv.slice(2).length) {
    minerva.outputHelp();
}

if (!uriArg) {
    console.error("No html given.");
    process.exit(1);
}
else if (!uriArg.toLowerCase().startsWith("<div") && !uriArg.toLowerCase().startsWith("chrome://")) {
    uriArg = url.format({
        protocol: "file",
        pathname: path.resolve(uriArg),
        slashes: true
	});
	isURL = true;
}

// Generate SHA1 hash if no output is specified
if (!outputArg) {
    const shasum = crypto.createHash("sha1");
    shasum.update(uriArg);
    outputArg = shasum.digest("hex") + ".png";
}

// Built-in timeout (exit) when debugging is off
if (!minerva.debug) {
    setTimeout(() => {
        console.error("Generation timed out.");
        process.exit(2);
    }, (minerva.timeout || 120) * 1000);
}


// Utils
const _complete = () => {
    if (!minerva.stdout) {
        console.timeEnd("PDF Conversion");
    }
    process.exit(0);
};

const _output = (data) => {
    if (minerva.stdout) {
        process.stdout.write(data, _complete);
    } else {
		const outputPath = path.join(process.cwd(), outputArg);
        fs.writeFile(outputPath, data, (err) => {
            if (err) console.error(err);
            console.info(`Converted '${uriArg}' to PNG: '${outputArg}'`);
            _complete();
        });
    }
};

async function _startConversion(html){
    if (!minerva.stdout) {
        console.time("PNG Conversion");
    }
	
	const browser = await puppeteer.launch({
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox'
		]
	});
	const page = await browser.newPage();
	
	if (isURL){
		page.goto(uriArg, { waitUntil: 'networkidle0' }).then(() => {
			page.$(".squiggle-wrapper").then((squiggleElement) => {
				squiggleElement.screenshot().catch((error) => {
					console.error(error);
					process.exit(2);
				})
				.then((imageBuffer) => {
					_output(imageBuffer);
				})
			}).catch((error) => {
				console.error(error);
				process.exit(2);
			})
		})
		.catch ((error) => {
			console.error(error);
			process.exit(2);
		});
	}
	else {
		page.goto(`data:text/html,${html}`, { waitUntil: 'networkidle0' }).then(() => {
			page.$(".squiggle-wrapper").then((squiggleElement) => {
				squiggleElement.screenshot().catch((error) => {
					console.error(error);
					process.exit(2);
				})
				.then((imageBuffer) => {
					_output(imageBuffer);
				})
			}).catch((error) => {
				console.error(error);
				process.exit(2);
			})
		})
		.catch ((error) => {
			console.error(error);
			process.exit(2);
		});
	}
}
_startConversion(uriArg);