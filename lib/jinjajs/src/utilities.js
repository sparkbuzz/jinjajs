/**
 * Compares the two given objects.
 *
 * @returns boolean
 */
Object.compare = function (a, b) {
    for (p in b) {
        if (typeof(a[p]) == 'undefined') {
            return false;
        }
    }

    for (p in b) {
        if (b[p]) {
            switch (typeof(b[p])) {
                case 'object':
                    if (!Object.compare(b[p], a[p])) {
                        return false;
                    }
                    break;
                case 'function':
                    if (typeof(a[p]) == 'undefined' || (p != 'equals' && b[p].toString() != a[p].toString())) {
                        return false;
                    }
                    break;
                default:
                    if (b[p] != a[p]) {
                        return false;
                    }
            }
        } else {
            if (a[p]) {
                return false;
            }
        }
    }

    for (p in a) {
        if (typeof(b[p]) == 'undefined') {
            return false;
        }
    }

    return true;
};

/**
 * Checks if the given primitive value is contained in the array.
 *
 * @param haystack The array to be searched.
 * @param needle The value to check for.
 *
 * @return boolean
 */
Array.contains = function (haystack, needle) {
    for (var i = 0; i < haystack.length; i++) {
        if ((needle instanceof Object)) {
            if (Object.compare(needle, haystack[i])) {
                return true;
            }
        } else if (needle == haystack[i]) {
            return true;
        }
    }
    return false;
};

/**
 * Converts a string like to title case. "this_string" becomes "This String"
 */
String.prototype.toTitleCase = function () {
    var split = this.split(/_/i);
    for (var i = 0; i < split.length; i++) {
        // Convert first character to uppercase.
        split[i] = split[i][0].toUpperCase() + split[i].substr(1, split[i].length);
    }
    return split.join(" ");
};

/**
 * Converts an underscore delimited string to camelcase.
 */
String.prototype.toCamelCase = function () {
    var tmp = this.split('_');
    var result = tmp[0];
    for (var i = 1; i < tmp.length; i++) {
        result += tmp[i].ucFirst();
    }
    return result;
};

/**
 * Uppercases the first character in the given string.
 *
 */
String.prototype.ucFirst = function () {
    return this[0].toUpperCase() + this.substr(1);
};

/**
 * Generates a simple randomized uid.
 */
Math.uid = function () {
    return (((1 + (new Date().valueOf() * Math.random())) * 0x10000) | 0).toString(16).substring(1);
};

/**
 * Tests if x, y coordinate is within the given top, left, width, height boundary rectangular area.
 */
isInsideBounds = function (x, y, left, top, width, height) {
    return x >= left && x <= left + width && y >= top && y <= top + height;
};
