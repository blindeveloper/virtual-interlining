const processVirtualInterlinig = require('../services/virtualInterlining.service')
const assert = require('assert')
const expect = require('chai').expect

describe('VIRTUAL INTELINING MAIN FLOW', () => {
  let result = []
  let oAndDwithDatesList = [{ DEPLocation: 'LON',
    ARRLocation: 'BKK',
    DEPdateTimeLeg1: '2018-11-07T00:00:00',
    DEPdateTimeLeg2: null
  }]

  before(async () => {
    await processVirtualInterlinig(oAndDwithDatesList, 'GB', (listOfFlights) => {
      result = result.concat(listOfFlights)
    })
  })

  it('should check the length of initial and resulted array', () => {
    assert.strictEqual(result.length, 1)
  })

  it('should check that init and query object are the same', () => {
    expect(result[0].flightInitQuery).to.eql(oAndDwithDatesList[0])
  })

  it('should check GDStoLCC and LCCtoGDS transfer cities', () => {
    if(result[0] && result[0].directions && result[0].directions.GDStoLCC.result) {
      let transferPointItinA = result[0].directions.GDStoLCC.result.itinA.transferPoint
      let transferPointItinB = result[0].directions.GDStoLCC.result.itinB.transferPoint
      assert.strictEqual(transferPointItinA, transferPointItinB)
    } else if (result[0] && result[0].directions && result[0].directions.LCCtoGDS.result) {
      let transferPointItinA = result[0].directions.LCCtoGDS.result.itinA.transferPoint
      let transferPointItinB = result[0].directions.LCCtoGDS.result.itinB.transferPoint
      assert.strictEqual(transferPointItinA, transferPointItinB)
    }
  })

})