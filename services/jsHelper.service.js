'use strict'
var csv = require('fast-csv')
const fs = require('fs')

const jsHelper = {
  toOneLineString: structure => {
    let oneLineString = '';
    for (let key in structure) {
      oneLineString = oneLineString.concat(key + '=' + structure[key] + '&')
    }
    return oneLineString
  },

  deepMap: (obj, f) => {
    return Object.keys(obj).reduce((acc, k) => {
      if ({}.toString.call(obj[k]) == '[object Object]') {
        acc[k] = jsHelper.deepMap(obj[k], f)
      } else {
        acc[k] = f(obj[k], k)
      }
      return acc
    },{})
  },

  joinObjects: arrObj => {
    let counter = 0
    return arrObj.reduce((acc, x, index) => {
      if((index) % 6 === 0) {
        counter++
        acc[counter] = {}
      }
  
      for (var key in x) acc[counter][key] = x[key]
      return acc
    }, {})
  },

  logIt: currentFlight => {
    jsHelper.storageContainer.push(currentFlight)
    console.log('currentFlight: ', currentFlight);
    // wstream.write(storageContainer)
  },

  fromToParser: list => {
    return list.map(el => {
      return {
        DEP: el.split('-')[0],
        ARR: el.split('-')[1]
      }
    })
  },

  getFilteredDate: d => {
    //here is schema: "2018-08-13T00:00:00"
    let year = d.getFullYear()
    let month = (d.getMonth() + '').length === 1 ? `0${d.getMonth()}` : d.getMonth()
    let date = (d.getDate() + '').length === 1 ? `0${d.getDate()}` : d.getDate()
    let hours = (d.getHours() + '').length === 1 ? `0${d.getHours()}` : d.getHours()
    let minutes = (d.getMinutes() + '').length === 1 ? `0${d.getMinutes()}` : d.getMinutes()
    let seconds = (d.getSeconds() + '').length === 1 ? `0${d.getSeconds()}` : d.getSeconds()
    return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`
  },

  getFullFlightsList: (flightPoints, flightDates) => {
    let fullList = []
  
    flightPoints.forEach(points => {
      flightDates.forEach(dates => {
        fullList.push({
          DEPLocation: points.DEP,
          ARRLocation: points.ARR,
          DEPdateTimeLeg1: dates.DEP,
          DEPdateTimeLeg2: dates.ARR
        })
      })
    });
  
    return fullList
  },

  handleBFMresponse: (currentFlight, BFMresponse) => {
    console.log('currentFlight: ', currentFlight);
    
    if (BFMresponse && BFMresponse.statusCode === 200) {
      currentFlight.GDS = Math.min(...BFMresponse.body.OTA_AirLowFareSearchRS.PricedItineraries.PricedItinerary
        .map(el => el.AirItineraryPricingInfo[0].ItinTotalFare.TotalFare.Amount))
        // csvStream.write({BFM_status: minItinPrice, b: "b0"});
    } else {
      currentFlight.GDS = 'noData'
    }
  },

  processArray: async function (flightList, BFMresource, DSSresource, DSS, BFM) {
    const csvStream = csv.createWriteStream({headers: true})
    const writableStream = fs.createWriteStream(`./logs/${new Date().getTime()}_log.csv`)
    csvStream.pipe(writableStream);

    for (const flightInitQuery of flightList) {
      let currentFlight = jsHelper.flightSchema()
      currentFlight.flightInitQuery = flightInitQuery
      let BFMdetails = jsHelper.getBFMdetails(flightInitQuery)

      await BFMresource.getBFM(BFMdetails)
      .then(BFMresponse => {
        jsHelper.handleBFMresponse(currentFlight, BFMresponse)
        currentFlight.GDS = BFMresponse.statusCode
        return DSSresource.getTransferAirport(BFMdetails.DEPLocation, BFMdetails.ARRLocation, BFMdetails.DEPdateTimeLeg1)
      })
      .then(DSSdataLeg => {
        currentFlight.directions = jsHelper.getSortedDSSbyDirection(DSS.getMmlList(DSS.getMmpList(DSSdataLeg)))
        return BFM.getBFMviaTransferPoint(BFMresource, currentFlight)
      })
      .then(result => {

      })
      .catch(err => {
        throw new Error(err)
      })

      // .then(DSSdataLeg2 => {
      //   jsHelper.getSortedDSSbyDirection(DSS.getMmlList(DSS.getMmpList(DSSdataLeg2)), currentFlight, 'leg2')
      //   jsHelper.findRoundTripItins(currentFlight, 'GDStoLCC')
      //   // jsHelper.findRoundTripItins(currentFlight, 'LCCtoGDS')
      //   return BFM.getBFMroundTripViaCity(BFMresource, currentFlight, 'GDStoLCC', flightInitQuery)
      //   // if (currentFlight.LCCtoGDS.roundTripList.length) {console.log('LCCtoGDS: ', currentFlight.LCCtoGDS.roundTripList)}
      // })
      
    }
    csvStream.end();
    console.log('done!');
  },

  getBFMdetails: flight => {
    return {
      DEPLocation: flight.DEPLocation,
      ARRLocation: flight.ARRLocation,
      DEPdateTimeLeg1: jsHelper.getFilteredDate(flight.DEPdateTimeLeg1),
      DEPdateTimeLeg2: jsHelper.getFilteredDate(flight.DEPdateTimeLeg2)
    }
  },
  
  storageContainer: [],

  flightSchema: () => new Object({
    GDS: {},
    directions: {}
  }),

  getSortedDSSbyDirection: DSSlist => {
    let sortedDSSlist = {
      GDStoLCC:{source:[], chunk1list:[], chunk2list:[]},
      LCCtoGDS:{source:[], chunk1list:[], chunk2list:[]}
    }
    DSSlist.forEach(el => {
      if (el['1'].TCR === 'true' && el['2'].LCC === 'true') {
        sortedDSSlist.GDStoLCC.source.push(el)
      }
      if (el['1'].LCC === 'true' && el['2'].TCR === 'true') {
        sortedDSSlist.LCCtoGDS.source.push(el)
      }
    })
    return sortedDSSlist
  },

  logToStdout: val => process.stdout.write(val),

  filerLegView: leg => `${leg['1'].OCT} - ${leg['1'].DCT} - ${leg['2'].OCT} - ${leg['2'].DCT}`,
  filterLegViewReversed: leg => `${leg['2'].DCT} - ${leg['2'].OCT} - ${leg['1'].DCT} - ${leg['1'].OCT}`,

  findRoundTripItins: (currentFlight, direction) => {
    if (currentFlight[direction].leg1.length && currentFlight[direction].leg2.length) {
      currentFlight[direction].leg1.forEach(leg1el => {
        currentFlight[direction].leg2.forEach(leg2el => {
          if (jsHelper.filerLegView(leg1el) === jsHelper.filterLegViewReversed(leg2el)) {
            currentFlight[direction].roundTripList.push(leg1el)
          }
        })
      })
    }
  },

  // processArrayParalel: async function (flightList, BFMresource, DSSresource, DSS, BFM) {
  //   // const wstream = fs.createWriteStream(`./logs/${new Date().getTime()}_log.txt`);
  //   const flightListPromises = flightList.map(flightInitQuery => {
  //     let currentFlight = jsHelper.flightSchema()
  //     let BFMdetails = jsHelper.getBFMdetails(flightInitQuery)

  //     return BFMresource.getBFM(BFMdetails)
  //     .then(BFMresponse => {
  //       currentFlight.GDS = BFMresponse.body
  //       return DSSresource.getTransferAirport(BFMdetails.DEPLocation, BFMdetails.ARRLocation, BFMdetails.DEPdateTimeLeg1)
  //     })
  //     .then(DSSdataLeg1 => {
  //       jsHelper.getSortedDSSbyDirection(DSS.getMmlList(DSS.getMmpList(DSSdataLeg1)), currentFlight, 'leg1')
  //       return DSSresource.getTransferAirport(BFMdetails.ARRLocation, BFMdetails.DEPLocation, BFMdetails.DEPdateTimeLeg2)
  //     })
  //     .then(DSSdataLeg2 => {
  //       jsHelper.getSortedDSSbyDirection(DSS.getMmlList(DSS.getMmpList(DSSdataLeg2)), currentFlight, 'leg2')
  //       jsHelper.findRoundTripItins(currentFlight, 'GDStoLCC')
  //       // jsHelper.findRoundTripItins(currentFlight, 'LCCtoGDS')
  //       return BFM.getBFMroundTripViaCity2(BFMresource, currentFlight, 'GDStoLCC', flightInitQuery)
  //       // if (currentFlight.LCCtoGDS.roundTripList.length) {console.log('LCCtoGDS: ', currentFlight.LCCtoGDS.roundTripList)}
  //     }).then(() => {

  //     }).catch(err => {
  //       throw new Error(err)
  //     })
  //   })
    
  //   await Promise.all(flightListPromises)
  //   // wstream.end();
  //   console.log('done!');
  // }
}

module.exports = jsHelper