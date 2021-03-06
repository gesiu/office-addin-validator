/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

import * as fs from 'fs';
import * as request from 'request';
import * as rp from 'request-promise';
import * as chalk from 'chalk';

let baseUri = 'https://verificationservice.osi.office.net/ova/addincheckingagent.svc/api/addincheck';
let options = {
  uri: baseUri,
  method: 'POST',
  headers: {
    'Content-Type': 'application/xml'
  },
  resolveWithFullResponse: true
};

export async function validateManifest(manifest: string) : Promise<string> {
  try {
    console.log('Calling validation service. This might take a moment...');
    let response = await callOmexService(manifest, options);
    if (response.statusCode === 200) {
      let formattedBody = JSON.parse(response.body.trim());
      let validationReport = formattedBody.checkReport.validationReport;
      let validationResult = validationReport.result;

      console.log('-------------------------------------');
      switch (validationResult) {
        case 'Passed':
          // supported products only exist when manifest is valid
          let supportedProducts = formattedBody.checkReport.details.supportedProducts;
          console.log(`${chalk.bold('Validation: ')}${chalk.bold.green('Passed')}`);
          logValidationReport(validationReport.warnings, 'warning');
          logValidationReport(validationReport.infos, 'info');
          logSupportedProduct(supportedProducts);
          break;
        case 'Failed':
          console.log(`${chalk.bold('Validation: ')}${chalk.bold.red('Failed')}`);
          logValidationReport(validationReport.errors, 'error');
          logValidationReport(validationReport.warnings, 'warning');
          logValidationReport(validationReport.infos, 'info');
          break;
      }
      console.log('-------------------------------------');
      return validationResult;
    }
    else {
      logError(response.statusCode);
      return 'Error';
    }
  } catch (err) {
    if (err.name === 'RequestError') {
      console.log('-------------------------------------');
      console.log('Error: Cannot reach service.');
      console.log('-------------------------------------');
    } else if (err.name === 'StatusCodeError') {
      let statusCode = err.statusCode;
      logError(statusCode);
    } else {
      console.log('-------------------------------------');
      console.log('Error: Unexpected error.');
      console.log('-------------------------------------');
    }
    return 'Error';
  }
}

async function callOmexService(file, options) {
  let fileStream = fs.createReadStream(file);
  let response = await fileStream.pipe(rp(options));
  return response;
}

function logError(statusCode) {
  console.log('-------------------------------------');
  console.log(`${chalk.bold('Validation: ')}${chalk.bold.red('Failed')}`);
  console.log('  Error Code: ' + statusCode);
  console.log(`  ${chalk.bold.red('Error(s): ')}`);
  switch (statusCode) {
    case 400:
      console.log('  Request body does not contain a valid XML document, and/or is too large (capped at 256kb).');
      break;
    case 415:
      console.log('  Content-Type is not set to application/xml.');
      break;
    case 500:
      console.log('  Unexpected error.');
      break;
    case 503:
      console.log('  Service unavailable; API processing has been disabled via BRS.');
      break;
  }
  console.log('-------------------------------------');
}

function logValidationReport(obj, name) {
  if (obj.length > 0) {
    switch (name) {
      case 'error':
        logErrors(obj);
        break;
      case 'warning':
        logWarnings(obj);
        break;
      case 'info':
        logInfos(obj);
        break;
    }
  }
}

// Provide detailed error information provided in the validationReport.errors object.
function logErrors(errors) {
  let n = 1;
  for (let e of errors) {
    console.log(`${chalk.bold.red('\nError #' + n + ': ')}`);
    logDetails(e);
    ++n;
  }
}

// Provide detailed warning information provided in the validationReport.warnings object.
function logWarnings(warnings) {
  let n = 1;
  for (let w of warnings) {
    console.log(`  ${chalk.bold.yellow('Warning  #' + n + ': ')}`);
    logDetails(w);
    ++n;
  }
}

// Provide detailed additional information provided in the validationReport.infos object.
function logInfos(infos) {
  for (let i of infos) {
    console.log(`  ${chalk.bold.blue('  Additional information: ')}`);
    logDetails(i);
  }
}

// Logs out the Code, Column, and/or Line value returned from the validation service.
// param: obj - either an validationReport.errors[x], validationReport.warnings[x], or validationReport.infos[x] object.
function logDetails(obj) {
  console.log('' + obj.title + ': ' + obj.detail + ' (link: ' + obj.link + ')');
  if (obj.code) {
    console.log('  - Details: ' + obj.code);
  }
  if (obj.line) {
    console.log('  - Line: ' + obj.line);
  }
  if (obj.column) {
    console.log('  - Column: ' + obj.column);
  }
}

function logSupportedProduct(obj) {
  if (obj.length > 0) {
    let product = [];
    getProduct(obj, product);
    let unique = [...new Set(product)];
    console.log(`Based on the requirements specified in your manifest, your add-in can run on the following platforms; your add-in will be tested on these platforms when you submit it to the Office Store:`);
    for (let i of unique) {
      console.log('  - ' + i);
    }
    console.log(`Important: This analysis is based on the requirements specified in your manifest and does not account for any runtime JavaScript calls within your add-in. For information about which API sets and features are supported on each platform, see Office Add-in host and platform availability. (https://dev.office.com/add-in-availability).\n`);
    console.log(`*This does not include mobile apps. You can opt-in to support mobile apps when you submit your add-in.`);
  }
}

function getProduct(array, result) {
  for (let i of array) {
    let itemTitle = i.title;
    result.push(itemTitle);
  }
}
