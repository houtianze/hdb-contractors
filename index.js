#!/usr/bin/env node

//@ts-check

const stream = require('stream');
const { promisify }= require('util');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const sleep = promisify(setTimeout)
const pipeline = promisify(stream.pipeline);

const mkdirp = require('mkdirp');
const got = require('got').default;
const { webkit } = require('playwright');
const ora = require('ora');
const beautify = require('js-beautify').html;
const { program } = require('commander');

const thisPackage = require('./package.json');
const version = thisPackage.version;

const Defaults = {
  OutputDirectory: '.',
  LastPage: '46',
}

const OutputFileName = 'hdb-contractors.html';
const CaseTrustImageUrl = 'https://services2.hdb.gov.sg/webapp/BN31AWERRCMobile/images/casetrust.JPG';
// const HDBSearchPage = 'https://services2.hdb.gov.sg/webapp/BN31AWERRCMobile/BN31SSearchContractor?searchAction=alphabitSearch&searchVal=';
const ListingPage = 'https://services2.hdb.gov.sg/webapp/BN31AWERRCMobile/BN31SSearchContractor?searchAction=link';

program.version(version);
program
  .option('-o, --output-directory <output directory>', 'The output directory', Defaults.OutputDirectory)
  .option('-l, --last-page <last page>', 'The last page number', Defaults.LastPage);

program.parse();

const options = program.opts();
console.log(`Program options: ${JSON.stringify(options)}`);

(async () => {
  const outputDirectory = options.outputDirectory.replace(/[/\\]+$/, '');
  let spinner;
  spinner = ora('retrieving the CaseTrust logo image');
  spinner.start();
  const images = 'images';
  await mkdirp(outputDirectory + path.sep + images);
  const caseTrustImageUrlSplitted = CaseTrustImageUrl.split('/');
  const savedImageName =
    outputDirectory + path.sep + images + path.sep +
    caseTrustImageUrlSplitted[caseTrustImageUrlSplitted.length - 1];
  await pipeline(
    got.stream(CaseTrustImageUrl),
    fs.createWriteStream(savedImageName)
  );
  spinner.stop();

  spinner = ora(`starting browser`);
  spinner.start();
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ListingPage);
  spinner.stop();
  let outHtml = `<!-- Retrieved on ${new Date()} -->\n<table>\n<tbody>\n`;
  const lastPage = parseInt(options.lastPage);
  for (let pageNo = 1; pageNo <= lastPage; pageNo++)  {
    spinner = ora(`retrieving CaseTrust contractors page ${pageNo}/${lastPage}`);
    spinner.start();
    await page.click(`text="${pageNo}"`);
    await page.selectOption('select[id="filterBy"]', 'caseTrust');
    let form = await page.innerHTML('#Record>tbody');
    // somebody did some shitty front-end coding
    form = form.replace(/<tr>\s*<\/tr>/gm, '');
    form = form.replace(/^\s*[\r\n]/gm, '');
    // if (pageNo !== 1) {
    //   form = form.replace(/<tr>(.|\r|\n)*?Email\s+Address\s*<\/th>(\s|\r|\n)*<\/tr>/gm, '');
    // }
    // outHtml += form;
    if (pageNo === lastPage) {
      outHtml += form;
    }
    await sleep(Math.random() * 1000);
    spinner.stop();
  }
  outHtml += '\n</tbody>\n</table>';
  outHtml = beautify(outHtml);
  await browser.close();

  spinner = ora(`creating output file - ${OutputFileName}`);
  spinner.start();
  await fsp.writeFile(outputDirectory + path.sep + OutputFileName, outHtml);
  spinner.stop();
})();
