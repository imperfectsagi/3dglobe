export interface RawStation {
  id: string;
  name: string;
  lines: string[];
  latitude: number;
  longitude: number;
}

export interface RawLine {
  id: string;
  name: string;
  color: string;
  stations: string[];
}

export interface RawConnection {
  from: string;
  to: string;
  line: string;
}

export interface RawInterchange {
  station: string;
  lines: string[];
}

export interface RawMetroData {
  metadata: {
    name: string;
    source: string;
    dataVersion: string;
    lastVerified: string;
    coordinateDatum: string;
  };
  lines: RawLine[];
  stations: RawStation[];
  connections: RawConnection[];
  interchanges: RawInterchange[];
}

export interface MetroStation extends RawStation {
  /** true if this station connects 2+ lines */
  isInterchange: boolean;
}

export interface MetroLine extends RawLine {
  /** total estimated run length in km */
  lengthKm: number;
}

/** A directed edge in the routing graph. */
export interface MetroEdge {
  from: string;
  to: string;
  line: string;
  distanceKm: number;
  timeMin: number;
}
