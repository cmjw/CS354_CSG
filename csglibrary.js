CSG = function() {
    this.polygons = [];
  };
  
  // Construct a CSG solid from a list of `CSG.Polygon` instances.
  CSG.fromPolygons = function(polygons) {
    var csg = new CSG();
    csg.polygons = polygons;
    return csg;
  };
  
  CSG.prototype = {
    clone: function() {
      var csg = new CSG();
      csg.polygons = this.polygons.map(function(p) { return p.clone(); });
      return csg;
    },
  
    toPolygons: function() {
      return this.polygons;
    },
  
    union: function(csg) {
      var a = new CSG.Node(this.clone().polygons);
      var b = new CSG.Node(csg.clone().polygons);
      a.clipTo(b);
      b.clipTo(a);
      b.invert();
      b.clipTo(a);
      b.invert();
      a.build(b.allPolygons());
      return CSG.fromPolygons(a.allPolygons());
    },
  
    subtract: function(csg) {
      var a = new CSG.Node(this.clone().polygons);
      var b = new CSG.Node(csg.clone().polygons);
      a.invert();
      a.clipTo(b);
      b.clipTo(a);
      b.invert();
      b.clipTo(a);
      b.invert();
      a.build(b.allPolygons());
      a.invert();
      return CSG.fromPolygons(a.allPolygons());
    },

    clippedBy: function(csg) {
      var a = new CSG.Node(this.clone().polygons);
      var b = new CSG.Node(csg.clone().polygons);
      a.clipTo(b);
      return CSG.fromPolygons(a.allPolygons());
    },
  
    intersect: function(csg) {
      var a = new CSG.Node(this.clone().polygons);
      var b = new CSG.Node(csg.clone().polygons);
      a.invert();
      b.clipTo(a);
      b.invert();
      a.clipTo(b);
      b.clipTo(a);
      a.build(b.allPolygons());
      a.invert();
      return CSG.fromPolygons(a.allPolygons());
    },
  
    // Return a new CSG solid with solid and empty space switched. This solid is
    // not modified.
    inverse: function() {
      var csg = this.clone();
      csg.polygons.map(function(p) { p.flip(); });
      return csg;
    }
  };



/**
 * Node
 */

CSG.Node = function(polygons) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polygons = [];
    if (polygons) this.build(polygons);
};
  
  CSG.Node.prototype = {
    clone: function() {
      var node = new CSG.Node();
      node.plane = this.plane && this.plane.clone();
      node.front = this.front && this.front.clone();
      node.back = this.back && this.back.clone();
      node.polygons = this.polygons.map(function(p) { return p.clone(); });
      return node;
    },
  
    // Convert solid space to empty space and empty space to solid space.
    invert: function() {
      for (var i = 0; i < this.polygons.length; i++) {
        this.polygons[i].flip();
      }
      this.plane.flip();
      if (this.front) this.front.invert();
      if (this.back) this.back.invert();
      var temp = this.front;
      this.front = this.back;
      this.back = temp;
    },
  
    // Recursively remove all polygons in `polygons` that are inside this BSP
    // tree.
    clipPolygons: function(polygons) {
      if (!this.plane) return polygons.slice();
      var front = [], back = [];
      for (var i = 0; i < polygons.length; i++) {
        this.plane.splitPolygon(polygons[i], front, back, front, back);
      }
      if (this.front) front = this.front.clipPolygons(front);
      if (this.back) back = this.back.clipPolygons(back);
      else back = [];
      return front.concat(back);
    },
  
    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `bsp`.
    clipTo: function(bsp) {
      this.polygons = bsp.clipPolygons(this.polygons);
      if (this.front) this.front.clipTo(bsp);
      if (this.back) this.back.clipTo(bsp);
    },
  
    // Return a list of all polygons in this BSP tree.
    allPolygons: function() {
      var polygons = this.polygons.slice();
      if (this.front) polygons = polygons.concat(this.front.allPolygons());
      if (this.back) polygons = polygons.concat(this.back.allPolygons());
      return polygons;
    },
  
    // Build a BSP tree out of `polygons`. When called on an existing tree, the
    // new polygons are filtered down to the bottom of the tree and become new
    // nodes there. Each set of polygons is partitioned using the first polygon
    // (no heuristic is used to pick a good split).
    build: function(polygons) {
      if (!polygons.length) return;
      if (!this.plane) this.plane = polygons[0].plane.clone();
      var front = [], back = [];
      for (var i = 0; i < polygons.length; i++) {
        this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
      }
      if (front.length) {
        if (!this.front) this.front = new CSG.Node();
        this.front.build(front);
      }
      if (back.length) {
        if (!this.back) this.back = new CSG.Node();
        this.back.build(back);
      }
    }
};

/**
 * Polygon
 */

CSG.Polygon = function(vertices, shared) {
    this.vertices = vertices;
    this.shared = shared;
    this.plane = CSG.Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
};
  
CSG.Polygon.prototype = {
    clone: function() {
      var vertices = this.vertices.map(function(v) { return v.clone(); });
      return new CSG.Polygon(vertices, this.shared);
    },
  
    flip: function() {
      this.vertices.reverse().map(function(v) { v.flip(); });
      this.plane.flip();
    }
};

/**
 * Plane
 */

CSG.Plane = function(normal, w) {
    this.normal = normal;
    this.w = w;
};
  
// `CSG.Plane.EPSILON` is the tolerance used by `splitPolygon()` to decide if a
// point is on the plane.
CSG.Plane.EPSILON = 1e-5;
  
CSG.Plane.fromPoints = function(a, b, c) {
    var n = b.minus(a).cross(c.minus(a)).unit();
    return new CSG.Plane(n, n.dot(a));
};
  
CSG.Plane.prototype = {
    clone: function() {
      return new CSG.Plane(this.normal.clone(), this.w);
    },
  
    flip: function() {
      this.normal = this.normal.negated();
      this.w = -this.w;
    },
  
    // Split `polygon` by this plane if needed, then put the polygon or polygon
    // fragments in the appropriate lists. Coplanar polygons go into either
    // `coplanarFront` or `coplanarBack` depending on their orientation with
    // respect to this plane. Polygons in front or in back of this plane go into
    // either `front` or `back`.
    splitPolygon: function(polygon, coplanarFront, coplanarBack, front, back) {
      var COPLANAR = 0;
      var FRONT = 1;
      var BACK = 2;
      var SPANNING = 3;
  
      // Classify each point as well as the entire polygon into one of the above
      // four classes.
      var polygonType = 0;
      var types = [];
      for (var i = 0; i < polygon.vertices.length; i++) {
        var t = this.normal.dot(polygon.vertices[i].pos) - this.w;
        var type = (t < -CSG.Plane.EPSILON) ? BACK : (t > CSG.Plane.EPSILON) ? FRONT : COPLANAR;
        polygonType |= type;
        types.push(type);
      }
  
      // Put the polygon in the correct list, splitting it when necessary.
      switch (polygonType) {
        case COPLANAR:
          (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
          break;
        case FRONT:
          front.push(polygon);
          break;
        case BACK:
          back.push(polygon);
          break;
        case SPANNING:
          var f = [], b = [];
          for (var i = 0; i < polygon.vertices.length; i++) {
            var j = (i + 1) % polygon.vertices.length;
            var ti = types[i], tj = types[j];
            var vi = polygon.vertices[i], vj = polygon.vertices[j];
            if (ti != BACK) f.push(vi);
            if (ti != FRONT) b.push(ti != BACK ? vi.clone() : vi);
            if ((ti | tj) == SPANNING) {
              var t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(vj.pos.minus(vi.pos));
              var v = vi.interpolate(vj, t);
              f.push(v);
              b.push(v.clone());
            }
          }
          if (f.length >= 3) front.push(new CSG.Polygon(f, polygon.shared));
          if (b.length >= 3) back.push(new CSG.Polygon(b, polygon.shared));
          break;
      }
    }
};

/**
 * Vertex
 */

CSG.Vertex = function(pos, normal) {
    this.pos = new CSG.Vector(pos);
    this.normal = new CSG.Vector(normal);
};
  
CSG.Vertex.prototype = {
    clone: function() {
      return new CSG.Vertex(this.pos.clone(), this.normal.clone());
    },
  
    // Invert all orientation-specific data (e.g. vertex normal). Called when the
    // orientation of a polygon is flipped.
    flip: function() {
      this.normal = this.normal.negated();
    },
  
    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate: function(other, t) {
      return new CSG.Vertex(
        this.pos.lerp(other.pos, t),
        this.normal.lerp(other.normal, t)
      );
    }
};

/**
 * 3D Vector
 */

CSG.Vector = function(x, y, z) {
    if (arguments.length == 3) {
      this.x = x;
      this.y = y;
      this.z = z;
    } else if ('x' in x) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
    } else {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
    }
};
  
CSG.Vector.prototype = {
    clone: function() {
      return new CSG.Vector(this.x, this.y, this.z);
    },
  
    negated: function() {
      return new CSG.Vector(-this.x, -this.y, -this.z);
    },
  
    plus: function(a) {
      return new CSG.Vector(this.x + a.x, this.y + a.y, this.z + a.z);
    },
  
    minus: function(a) {
      return new CSG.Vector(this.x - a.x, this.y - a.y, this.z - a.z);
    },
  
    times: function(a) {
      return new CSG.Vector(this.x * a, this.y * a, this.z * a);
    },
  
    dividedBy: function(a) {
      return new CSG.Vector(this.x / a, this.y / a, this.z / a);
    },
  
    dot: function(a) {
      return this.x * a.x + this.y * a.y + this.z * a.z;
    },
  
    lerp: function(a, t) {
      return this.plus(a.minus(this).times(t));
    },
  
    length: function() {
      return Math.sqrt(this.dot(this));
    },
  
    unit: function() {
      return this.dividedBy(this.length());
    },
  
    cross: function(a) {
      return new CSG.Vector(
        this.y * a.z - this.z * a.y,
        this.z * a.x - this.x * a.z,
        this.x * a.y - this.y * a.x
      );
    }
};


/**
 * SHAPES
 */

CSG.cube = function(options) {
    options = options || {};
    var c = new CSG.Vector(options.center || [0, 0, 0]);
    var r = !options.radius ? [1, 1, 1] : options.radius.length ?
             options.radius : [options.radius, options.radius, options.radius];
    return CSG.fromPolygons([
      [[0, 4, 6, 2], [-1, 0, 0]],
      [[1, 3, 7, 5], [+1, 0, 0]],
      [[0, 1, 5, 4], [0, -1, 0]],
      [[2, 6, 7, 3], [0, +1, 0]],
      [[0, 2, 3, 1], [0, 0, -1]],
      [[4, 5, 7, 6], [0, 0, +1]]
    ].map(function(info) {
      return new CSG.Polygon(info[0].map(function(i) {
        var pos = new CSG.Vector(
          c.x + r[0] * (2 * !!(i & 1) - 1),
          c.y + r[1] * (2 * !!(i & 2) - 1),
          c.z + r[2] * (2 * !!(i & 4) - 1)
        );
        return new CSG.Vertex(pos, new CSG.Vector(info[1]));
      }));
    }));
};

CSG.sphere = function(options) {
  options = options || {};
  var c = new CSG.Vector(options.center || [0, 0, 0]);
  var r = options.radius || 1;
  var slices = options.slices || 16;
  var stacks = options.stacks || 8;
  var polygons = [], vertices;
  function vertex(theta, phi) {
    theta *= Math.PI * 2;
    phi *= Math.PI;
    var dir = new CSG.Vector(
      Math.cos(theta) * Math.sin(phi),
      Math.cos(phi),
      Math.sin(theta) * Math.sin(phi)
    );
    vertices.push(new CSG.Vertex(c.plus(dir.times(r)), dir));
  }
  for (var i = 0; i < slices; i++) {
    for (var j = 0; j < stacks; j++) {
      vertices = [];
      vertex(i / slices, j / stacks);
      if (j > 0) vertex((i + 1) / slices, j / stacks);
      if (j < stacks - 1) vertex((i + 1) / slices, (j + 1) / stacks);
      vertex(i / slices, (j + 1) / stacks);
      polygons.push(new CSG.Polygon(vertices));
    }
  }
  return CSG.fromPolygons(polygons);
};