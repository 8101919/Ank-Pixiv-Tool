
var AnkStorage = function (filename, tables) {
  this.filename = filename;
  this.tables = {};

  for (var key in tables) {
    this.tables[key] = new AnkTable(key, tables[key]);
  }

  var file = Components.classes["@mozilla.org/file/directory_service;1"].
              getService(Components.interfaces.nsIProperties).
              get("ProfD", Components.interfaces.nsIFile);
  file.append(filename);
  var storageService = Components.classes["@mozilla.org/storage/service;1"].
                         getService(Components.interfaces.mozIStorageService);
  this.database = storageService.openDatabase(file);

  this.createTables();

  return this;
};


AnkStorage.prototype = {
  insert: function (table, values) {
    if ('string' == typeof table)
      table = this.tables[table];

    var ns = [], vs = [], ps = [], vi = 0;
    for (var fieldName in values) {
      ns.push(fieldName);
      (function (idx, type, value) {
        dump(idx+type+value+"\n");
        vs.push(function (stmt) {
          switch (type) {
            case 'string':   return stmt.bindUTF8StringParameter(idx, value);
            case 'integer':  return stmt.bindInt32Parameter(idx, value);
            case 'datetime': return stmt.bindUTF8StringParameter(idx, value);
            default:         return stmt.bindNullParameter(idx);
          }
        });
      })(vi, table.fields[fieldName], values[fieldName]);
      ps.push('?' + (++vi));
    }

    var q = 'insert into ' + table.name + ' (' + AnkUtils.join(ns) + ') values(' + AnkUtils.join(ps) + ');'
    dump(q + "\n");
    var stmt = this.database.createStatement(q);
    try {
      for (var i in vs)
        (vs[i])(stmt);
      var result = stmt.executeStep();
    } finally {
      stmt.reset();
    }
  },


  /*
   * $BI,$:!"(Bresult.reset $B$9$k$3$H!#(B
   */
  find: function (tableName, conditions) {
    var q = 'select * from ' + tableName + ' where ' + conditions;
    dump(q);
    return this.database.createStatement(q);
  },


  exists: function (tableName, conditions) {
    var result, stmt = this.find.apply(this, arguments);
    try {
      result = !!(stmt.executeStep());
      dump(result);
    } finally {
      stmt.reset();
    }
    // boolean $B$rJV$9$h$&$K$9$k(B
    return result;
  },


  createTables: function () {
    //$B%G!<%?%Y!<%9$N%F!<%V%k$r:n@.(B
    for (var tableName in this.tables) {
      this.createTable(this.tables[tableName]);
    }
  },


  createTable: function (table) {
    if (this.database.tableExists(table.name))
      return this.updateTable(table);

    var fs = [];
    for (var fieldName in table.fields) {
      fs.push(fieldName + " " + table.fields[fieldName]);
    }      

    return this.database.createTable(table.name, AnkUtils.join(fs));
  },


  tableInfo: function (tableName) {
    var storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                       Components.interfaces.mozIStorageStatementWrapper);
    var q = 'pragma table_info (' + tableName + ')';
    var stmt = this.database.createStatement(q);
    storageWrapper.initialize(stmt);
    var result = {};
    while (storageWrapper.step()) {
      result[storageWrapper.row["name"]] = {type: storageWrapper.row["type"]};
    }
    return result;
  },


  updateTable: function (table) {
    try {
    dump("updateTable()\n");
    var etable = this.tableInfo(table.name);
    for (var fieldName in table.fields) {
      if (etable[fieldName])
        continue;
      dump(fieldName + "\n");
      var q = "alter table " + table.name + ' add column ' + fieldName + ' ' + table.fields[fieldName];
      this.database.executeSimpleSQL(q);
    }
    } catch(e) { dump("updateTable: " + e + "\n"); }
  },
};



var AnkTable = function (name, fields) {
  this.name = name;
  this.fields = fields;
  return this;
};



