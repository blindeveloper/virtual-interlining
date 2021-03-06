'use strict'

const {JSDOM} = require('jsdom')
const js2xmlparser = require('js2xmlparser')
const jsHelper = require('../jsHelper.service')
const request = require('request')

const getRequest = currentFlight => {
  let origin = currentFlight.flightInitQuery.DEPLocation
  let destination = currentFlight.flightInitQuery.ARRLocation
  let date = currentFlight.flightInitQuery.DEPdateTimeLeg1
  let market = currentFlight.market
  
  if (market === 'RU' || market === 'US') {
    return {
      '@': {COR: 'Sabre', VER: '1.0', CNP: true},
      BIL: {
        '@': {AAA: '61N1', AKD: 'S', CSV: 'MMODAL', PID: 'AA', TXN: 123, UCD: '61N1'}
      },
      SEG: {
        '@': {SMN: 2, SMX: 2}
      },
      ODM: {
        '@': {BRD: origin, OFF:destination, BTP:'C', OTP:'C'}
      },
      DAT: {
        '@': {TG1: date}
      }
    }
  } else {
    return {
      '@': {COR: 'Sabre', VER: '1.0'},
      BIL: {
        '@': {AAA: '61N1', AKD: 'S',CSV: 'MMODAL', PID: 'AA', TXN: 123, UCD: '61N1'}
      },
      SEG: {
        '@': {SMN: 2, SMX: 2}
      },
      MMS: {
        ODM: {
          '@': {BRD: origin, OFF:destination, BTP:'C', OTP:'C'}
        },
        DTM: {
          '@': {TGD: date}
        },
        CTM: {
          '@': {CNC: 0, CNA: 1439}
        },
        OTM: {
          '@': {RGT: false}
        }
      }
    }
  }
}

const getOneLinedBody = currentFlight => {
  let body = {
    request: js2xmlparser.parse('DSS', getRequest(currentFlight)),
    connectionPrefix: 'tcpip.',
    stylesheet: 'results-raw.xsl',
    'namingConnection.type': 'com.sabre.atse.dss.communication.DssNamingConnectionDescriptor',
    'namingConnection.invokerClassName': 'com.sabre.atse.dss.communication.DssInvoker',
    serverName: 'ABHIJIT',
    'namingConnection.nameServerHost': 'directorycrt.sabre.com',
    'namingConnection.nameServerPort': 27000,
    'namingConnection.namingContext': 'Shared/IDL:SDM_PUBLIC\/SDM_request:1\.0.IDL/Common.dev/SDMPublic\/ABHIJIT',
    'namingConnection.interface': 'idl',
    'namingConnection.methodName': 'getSchedsAvailDiag',
    'iorConnection.type': 'com.sabre.atse.dss.communication.DssIORConnectionDescriptor',
    'iorConnection.invokerClassName': 'com.sabre.atse.dss.communication.DssInvoker',
    'iorConnection.interface': 'idl',
    'iorConnection.methodName': 'getSchedsAvailDiag',
    'tcpip.type': 'com.sabre.xmlconnection.tcpip.TCPIPConnectionDescriptor',
    'tcpip.serverName': 'dss.v2.cert.ha.sabre.com',
    'tcpip.port': 54201,
    'tcpip.socketTimeout': 15000,
    submit: 'Send Request'
  }

  return jsHelper.toOneLineString(body)
}

const getheaders = () => {
  return {
    'Host': 'utt.cert.sabre.com',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Origin': 'http//utt.cert.sabre.com',
    'Upgrade-Insecure-Requests': 1,
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}

const DSSResource = {
  getTransferAirport: currentFlight => {
    return new Promise(resolve => {
      request.post({
        host: 'http://utt.cert.sabre.com',
        path: '/utt/dss/sendrequest',
        headers: getheaders(),
        url: 'http://utt.cert.sabre.com/utt/dss/sendrequest',
        body: getOneLinedBody(currentFlight)
      }, (error, response) => {
        if (error || !response) {
          console.log('DSS error: ', error)
          resolve()
        } else {
          console.log('DSS: OK')
          resolve(new JSDOM(response.body))
        }
      })
    })
  }
}

module.exports = DSSResource