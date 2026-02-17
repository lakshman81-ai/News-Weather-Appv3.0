export class Pfc_PcfGenerator {
  constructor(groups) {
    this.groups = groups;
    this.pcfLines = [];
    this.lastEndpoint = null;
    this.lastBore = 0;
    this.maxPipeLength = 13100; // Matches observed segment length in Expected PCF
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

    if (dist <= 1.0) return; // Skip negligible gaps

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
    // For TEE, rows are often 8(1), 9(3), 10(0), 11(2).
    // Start is 8. End is 11.
    // Branch is 9. Centre is 10.

    const startCoord = startRow.coords;
    const endCoord = endRow.coords;
    const bore = startRow.bore || this.lastBore;
    this.lastBore = bore;

    // Implicit Pipe Check
    if (this.lastEndpoint) {
      // If BRAN, it's a jump/start point, so do NOT connect to previous
      if (group.type !== 'BRAN') {
          this.generatePipe(this.lastEndpoint, startCoord, bore);
      }
    } else {
        if (group.type === 'BRAN') {
            this.lastEndpoint = startCoord;
            return;
        }
        // If not BRAN, assume start point is implicit start?
        // Usually pipe starts with BRAN or FLAN.
    }

    // Component Generation
    switch (group.type) {
      case 'BRAN':
        // Do nothing (handled in Implicit Pipe Check)
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
        this.pcfLines.push(`    FLAT-DIRECTION `); // Empty in expected
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
        this.pcfLines.push(`    CO-ORDS       ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    SKEY ANCH`);
        // Support consumes NO length. lastEndpoint stays at startCoord (which is same as endCoord for ANCI)
        // Ensure lastEndpoint is updated to endCoord.
        break;

      case 'FLAN':
      case 'FBLI':
      case 'GASK':
      case 'PCOM':
        // Check if GASK?
        // If it's a gasket, we might want to merge or handle specifically.
        // For now, treat as PIPE-FIXED to match general structure.
        this.pcfLines.push('PIPE-FIXED');
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(startCoord, bore)}`);
        this.pcfLines.push(`    END-POINT  ${this.formatCoord(endCoord, bore)}`);
        this.pcfLines.push(`    SKEY FPFA`);
        break;

      default:
        console.warn(`Unknown type: ${group.type}`);
    }

    this.lastEndpoint = endCoord;
  }
}
