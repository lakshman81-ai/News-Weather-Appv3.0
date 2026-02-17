export class Pfc_PcfGenerator {
  constructor(groups) {
    this.groups = groups;
    this.pcfLines = [];
    this.lastEndpoint = null;
    this.lastBore = 0;

    // Configuration
    this.maxPipeLength = 13100; // Standard cut length
    this.continuityTolerance = 6.0; // +/- 6mm tolerance
  }

  generate() {
    this.pcfLines.push('ISOGEN-FILES ISOGEN.FLS');
    this.pcfLines.push('UNITS-BORE MM');
    this.pcfLines.push('UNITS-CO-ORDS MM');
    this.pcfLines.push('UNITS-WEIGHT KGS');
    this.pcfLines.push('UNITS-BOLT-DIA MM');
    this.pcfLines.push('UNITS-BOLT-LENGTH MM');
    this.pcfLines.push('PIPELINE-REFERENCE SYS-30-B7410250');
    this.pcfLines.push('    PROJECT-IDENTIFIER ');
    this.pcfLines.push('    AREA  ');
    this.pcfLines.push('    ATTRIBUTE5 ');
    this.pcfLines.push('    ATTRIBUTE7 ');
    this.pcfLines.push('    ATTRIBUTE10 ');
    this.pcfLines.push('    ATTRIBUTE11 ');

    this.groups.forEach((group, index) => {
      this.processGroup(group, index);
    });

    return this.pcfLines.join('\n');
  }

  formatCoord(coord, bore) {
    const formatNum = (n) => (n || 0).toFixed(4).padStart(15, ' ');
    return `${formatNum(coord.x)} ${formatNum(coord.y)} ${formatNum(coord.z)} ${formatNum(bore)}`;
  }

  generatePipe(start, end, bore) {
    // Check distance
    const dist = Math.sqrt(
      Math.pow(end.x - start.x, 2) +
      Math.pow(end.y - start.y, 2) +
      Math.pow(end.z - start.z, 2)
    );

    // Tolerance Check
    // If gap is extremely small (< 0.1mm), ignore it (assume continuous).
    if (dist < 0.1) return;

    if (dist > this.maxPipeLength) {
      // Split into segments
      const segments = Math.ceil(dist / this.maxPipeLength);
      const vec = {
        x: (end.x - start.x) / dist,
        y: (end.y - start.y) / dist,
        z: (end.z - start.z) / dist
      };

      let currentStart = { ...start };
      for (let i = 0; i < segments; i++) {
        const segLen = (i === segments - 1) ? (dist - i * this.maxPipeLength) : this.maxPipeLength;
        const currentEnd = {
          x: currentStart.x + vec.x * segLen,
          y: currentStart.y + vec.y * segLen,
          z: currentStart.z + vec.z * segLen
        };

        this.pcfLines.push('PIPE');
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(currentStart, bore)}`);
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(currentEnd, bore)}`);

        currentStart = currentEnd;
      }
    } else {
      this.pcfLines.push('PIPE');
      this.pcfLines.push(`    END-POINT  ${this.formatCoord(start, bore)}`);
      this.pcfLines.push(`    END-POINT  ${this.formatCoord(end, bore)}`);
    }
  }

  processGroup(group, index) {
    const startRow = group.rows[0];
    const endRow = group.rows[group.rows.length - 1];

    let centreRow = group.rows.find(r => r.pointIdx === 0);
    let branchRow = group.rows.find(r => r.pointIdx === 3);

    // Heuristics
    if (group.type === 'ELBO' && !centreRow && group.rows.length === 3) {
      centreRow = group.rows[1];
    }

    // Coordinates
    let startCoord = { ...startRow.coords };
    const endCoord = endRow.coords;
    const bore = startRow.bore || this.lastBore;
    this.lastBore = bore;

    // Connectivity Logic
    if (this.lastEndpoint) {
      if (group.type === 'BRAN') {
         // Break in continuity (Jump)
         // Do not generate pipe.
         // Do not snap.
      } else {
         const dist = Math.sqrt(
            Math.pow(startCoord.x - this.lastEndpoint.x, 2) +
            Math.pow(startCoord.y - this.lastEndpoint.y, 2) +
            Math.pow(startCoord.z - this.lastEndpoint.z, 2)
         );

         if (dist <= this.continuityTolerance) {
            // SNAP: Inside tolerance window (e.g. 6mm).
            // Assume connected. Move startCoord to lastEndpoint to ensure perfect continuity.
            if (dist > 0.001) {
               // console.log(`Snapping gap of ${dist.toFixed(2)}mm at index ${index}`);
               startCoord = { ...this.lastEndpoint };
            }
         } else {
            // GAP: Outside tolerance. Generate Implicit Pipe.
            this.generatePipe(this.lastEndpoint, startCoord, bore);
         }
      }
    } else {
        if (group.type === 'BRAN') {
            this.lastEndpoint = startCoord;
            return;
        }
    }

    // Component Generation
    switch (group.type) {
      case 'BRAN':
        // No component output, just a topology marker
        break;

      case 'TEE':
      case 'OLET':
        this.pcfLines.push('TEE');
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(endCoord, bore)}`);
        if (centreRow) {
          const c = centreRow.coords;
          const cStr = `${(c.x).toFixed(4)} ${(c.y).toFixed(4)} ${(c.z).toFixed(4)}`;
          this.pcfLines.push(`    CENTRE-POINT  ${cStr.padStart(35, ' ')}`);
        }
        if (branchRow) {
           this.pcfLines.push(`    BRANCH1-POINT  ${this.formatCoord(branchRow.coords, branchRow.bore)}`);
        }
        this.pcfLines.push(`    SKEY TEBW`);
        break;

      case 'ELBO':
      case 'BEND':
        this.pcfLines.push('BEND');
        this.pcfLines.push(`    END-POINT     ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    END-POINT     ${this.formatCoord(endCoord, bore)}`);
        if (centreRow) {
           const c = centreRow.coords;
           const cStr = `${(c.x).toFixed(4)} ${(c.y).toFixed(4)} ${(c.z).toFixed(4)}`;
           this.pcfLines.push(`    CENTRE-POINT  ${cStr.padStart(35, ' ')}`);
        }
        this.pcfLines.push(`    SKEY BEBW`);
        this.pcfLines.push(`    ANGLE            9000`);
        const radius = parseFloat((startRow['Radius'] || '0').replace('mm',''));
        if (radius > 0) {
            this.pcfLines.push(`    BEND-RADIUS        ${radius.toFixed(4)}`);
        } else if (centreRow && centreRow['Radius']) {
             const r = parseFloat(centreRow['Radius'].replace('mm',''));
             if (r>0) this.pcfLines.push(`    BEND-RADIUS        ${r.toFixed(4)}`);
        }
        break;

      case 'REDU':
        this.pcfLines.push('REDUCER-ECCENTRIC');
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(startCoord, startRow.bore)}`);
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(endCoord, endRow.bore)}`);
        this.pcfLines.push(`    FLAT-DIRECTION `);
        this.pcfLines.push(`    SKEY REBW`);
        break;

      case 'VALV':
         this.pcfLines.push('VALVE-ANGLE');
         this.pcfLines.push(`    END-POINT  ${this.formatCoord(startCoord, bore)}`);
         this.pcfLines.push(`    END-POINT  ${this.formatCoord(endCoord, bore)}`);
         const vCentre = centreRow ? centreRow.coords : startCoord;
         const vcStr = `${(vCentre.x).toFixed(4)} ${(vCentre.y).toFixed(4)} ${(vCentre.z).toFixed(4)}`;
         this.pcfLines.push(`    CENTRE-POINT  ${vcStr.padStart(35, ' ')}`);
         this.pcfLines.push(`    SKEY AVBW`);
         break;

      case 'ANCI':
        // SUPPORT
        this.pcfLines.push('SUPPORT');
        // Support is at a single point (startCoord).
        this.pcfLines.push(`    CO-ORDS       ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    SKEY ANCH`);
        // Support does not advance the geometry.
        // It's attached to the line.
        // We should NOT update lastEndpoint to the support's coord if we want continuity
        // BUT if the CSV sequence flows through the support, then the next pipe starts FROM the support location.
        // In Sys-1, ANCI rows are sequential along the line.
        // So we MUST update lastEndpoint to startCoord (which is where the support is).
        // This allows the next pipe to start from the support.
        // Note: For ANCI, startCoord == endCoord usually.
        break;

      case 'FLAN':
      case 'FBLI':
      case 'GASK':
      case 'PCOM':
        this.pcfLines.push('PIPE-FIXED');
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(endCoord, bore)}`);
        this.pcfLines.push(`    SKEY FPFA`);
        break;

      default:
        console.warn(`Unknown type: ${group.type}`);
    }

    // Update lastEndpoint
    // For ANCI, startCoord is the point. endCoord is same.
    // So lastEndpoint becomes the support location.
    this.lastEndpoint = endCoord;
  }
}
