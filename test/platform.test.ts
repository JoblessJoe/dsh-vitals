// Parser checks for the macOS / Windows readers against captured output.
// Run: node test/platform.test.ts   (Node 22.18+ strips the types itself)
import assert from 'node:assert/strict'
import { parseIoreg, parseVmStat, parseWmiTemps } from '../src/platform.ts'

const vmStat = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               10000.
Pages active:                            500000.
Pages inactive:                          200000.
Pages speculative:                         5000.
Pages throttled:                              0.
Pages wired down:                        150000.
Pages purgeable:                           1000.
`
assert.equal(parseVmStat(vmStat), (10000 + 200000 + 5000 + 1000) * 16384)
assert.equal(parseVmStat('garbage'), null)

const ioreg = `+-o AGXAcceleratorG14X  <class AGXAcceleratorG14X, id 0x100000356, registered, matched, active, busy 0 (0 ms), retain 49>
    {
      "model" = "Apple M2 Pro"
      "gpu-core-count" = 19
      "PerformanceStatistics" = {"In use system memory"=734003200,"Device Utilization %"=37,"Renderer Utilization %"=30,"Tiler Utilization %"=12}
    }
`
assert.deepEqual(parseIoreg(ioreg), [{ name: 'Apple M2 Pro', util: 37, memUsedMb: 700 }])
assert.deepEqual(parseIoreg(''), [])

assert.deepEqual(parseWmiTemps('3132\r\n3232\r\n\r\n'), [40.1, 50.1])
assert.deepEqual(parseWmiTemps(''), [])

console.log('platform parsers ok')
