JinjaJs = (function () {

    // Private members...

    /**
     * Recursion depth counter for rendering. When this reaches 0, the render-complete event is fired.
     */
    var counter = 0;

    /**
     * @class JinjaParser
     */
    var JinjaParser = function (template, data, global) {

        /**
         * @var template
         */
        this.template = template;

        /**
         * @var templatePath
         */
        this.templatePath = undefined;

        /**
         * @var data
         */
        this.data = data;

        /**
         * @var parsedTemplate
         */
        this.parsedTemplate = undefined;

        /**
         * @var global
         */
        this.global = global;

        /**
         * Returns the template path name, derived from the given template identifier.
         *
         * @param template A string containing template identifier like my:base:template.jinja
         *
         * @return string A string like /modules/my/base/view/template.jinja is returned.
         */
        this.getTemplatePath = function (template) {
            var path = template.split(':');
            return (path[0] != "" ? path[0] + '/' : "") + (path[1] != "" ? path[1] + '/view/' : "") + path[2];
        };

        /**
         * Returns the parsed template in it's current state.
         */
        this.getParsedTemplate = function () {
            return this.parsedTemplate;
        };

        /**
         * Main parse entry point.
         *
         * @param input
         * @param data
         */
        this.parse = function (input, data) {
            input = this.parseInheritance(input, data);
            input = this.parseInclude(input, data);
            input = this.parseRender(input, data);
            input = this.parseControlStructures(input, data);
            input = this.parseVariables(input, data);
            return input;
        };

        /**
         *
         * @param input
         * @param data
         * @param variableName
         */
        this.parseControlStructures = function (input, data, variableName) {
            // Match either {% if or {% for tags...
            var regex = /(\{% *if)|(\{% *for) /g;
            var match = regex.exec(input);

            while (match != null) {

                if (match[0].trim().match(/{% *if/) != null) {
                    // Process if block
                    input = this.parseIf(input, data, variableName);
                } else if (match[0].trim().match(/{% *for/)) {
                    // Process for loop block
                    input = this.parseFor(input, data);
                } else {
                    throw new Error('JinjaJS parser exception. Unknown control structure tag...');
                }

                // Proceed to next if/for statement.
                newRegex = /(\{% *if)|(\{% *for) /g; // Use new RegExp instance, otherwise nested statements won't evaluate.
                match = newRegex.exec(input);
            }

            return input;
        };

        /**
         * Parses {% for x in y %} control structures
         *
         * @param input
         * @param data
         */
        this.parseFor = function (input, data) {
            // Matches beginning of {% for tag
            var regex = /\{% *for /g;
            var match = regex.exec(input);

            if (match == null) {
                return input;
            }

            // Find statement closing %}
            var terminator = input.indexOf("%}", match.index) + 2;
            var statement = input.substring(match.index, terminator);

            // Find closing {% endfor %{ tag.
            var regex2 = /{% *endfor *%}/g;
            var endfor = regex2.exec(input.substring(terminator));

            // Find if block, and expand until closing {% endfor %} has been found
            var forBlock = input.substr(match.index, endfor.index + endfor[0].length + (terminator - match.index));
            while (forBlock.match(/{% *for /g).length != forBlock.match(/{% *endfor *%}/g).length) {
                // Expand the if block selection.
                endfor = regex2.exec(input.substring(terminator));
                forBlock = input.substr(match.index, endfor.index + endfor[0].length + (terminator - match.index));
            }

            // Extract "item in items" clause
            var forStatement = forBlock.substring(0, forBlock.indexOf('%}') + 2);
            var condition = forStatement.replace(/\{% *for /g, "").replace(/%\}/g, "").trim();
            var variableName = condition.split(/ ?in ?/)[0];

            var template = forBlock.replace(forStatement, "").substring(0, endfor.index);

            // Resolve the target object to be iterated.
            var targetString = condition.split(/ ?in ?/)[1];
            var targetObject = null;

            with (data) {
                try {
                    targetObject = eval(targetString);
                } catch (error) {
                    // Attempt to resolve from __parent_scope. This could be a nested {% for ... %} statement.
                    if (data['__parent_scope__'] != null && data['__parent_scope__'] != undefined) {
                        targetObject = data['__parent_scope__'][targetString];
                    } else {
                        console.error('JinjaJS was unable to resolve "' + targetString + '" in template ' +
                        this.template);
                    }
                }
            }

            // Evaluate for block
            var forResult = "";
            if (data != null && data != undefined) {
                for (var item in targetObject) {
                    var dataItem = {};
                    dataItem[variableName] = targetObject[item];

                    var newScope = data;
                    newScope[variableName] = targetObject[item];
                    newScope['__parent_scope__'] = targetObject[item];

                    var result = this.parseControlStructures(template, newScope, variableName)
                        .trim();
                    result = this.parseVariables(result, dataItem);
                    forResult += result;
                }
            }

            // Replace result in original template.
            input = input.replace(forBlock, forResult);
            return input;
        };

        /**
         * Parses control structures like {% if ... %} and {% for ... %}
         *
         * @param input
         * @param data
         * @param root
         */
        this.parseIf = function (input, data, root) {
            // List of all if else branches in an array.
            var branches = [];

            // Matches beginning of {% if ... tag
            var regex = /\{% *if /g;
            var match = regex.exec(input);

            if (match == null) {
                return input;
            }

            // Find statement closing %}
            var terminator = input.indexOf("%}", match.index) + 2;
            var statement = input.substring(match.index, terminator);

            // Find closing {% endif %{ tag.
            var regex2 = /{% *endif *%}/g;
            var endif = regex2.exec(input.substring(terminator));

            // Find if block, and expand until closing {% endif %} has been found
            var ifBlock = input.substr(match.index, endif.index + endif[0].length + (terminator - match.index));
            while (ifBlock.match(/{% *if /g).length != ifBlock.match(/{% *endif *%}/g).length) {
                // Expand the if block selection.
                endif = regex2.exec(input.substring(terminator));
                ifBlock = input.substr(match.index, endif.index + endif[0].length + (terminator - match.index));
            }

            // Check the block line by line to determine {% else if ... %} blocks
            var lines = ifBlock.match(/^.*((\r\n|\n|\r)|$)/gm);
            var depth = 0; // If block depth
            var block = "";
            for (var i in lines) {
                if (lines[i].match(/{% *if /)) {
                    depth++;
                }
                if (lines[i].match(/{% *endif *%}/)) {
                    depth--;
                }
                // If the {% else if ... %] is at depth == 1, we grab it, otherwise just ignore.
                if (lines[i].match(/{% *else */) || depth == 0) {
                    if (depth == 0 && i == 0) {
                        // Single line statement, grab the block, by stripping the {% endif %} and {% if ... %}
                        block = '\r\n' + lines[i].substring(lines[i].indexOf('%}') + 2)
                            .replace(/{% *endif *%}/, '');
                    }
                    if (depth <= 1) {
                        // Add if block to branches variable.
                        branches.push({
                            statement: statement,
                            // slice(1) to omit statement line from block.
                            block: block.split(/[\r\n]|[\n]|[\r]/).slice(1).join('\r\n')
                        });
                        block = "";
                        try {
                            statement = lines[i].substring(
                                lines[i].match(/{% *else */).index, lines[i].indexOf('%}') + 2);
                        } catch (e) { /* Do nothing... */
                        }
                    }
                }
                block += lines[i];
            }

            // Evaluate if statements.
            var trueStatementFound = false;
            for (var i in branches) {
                var condition = branches[i].statement.replace(/({% *(else )?if )|( *%})/g, "");
                if (condition.trim().match(/{% *else/) != null) {
                    condition = true;
                }
                // Resolve template to if branch evaluating to true.
                if (data != undefined) {
                    with (data) {
                        try {
                            if (eval(condition)) {
                                input = input.replace(ifBlock, branches[i].block);
                                trueStatementFound = true;
                                break;
                            }
                        } catch (error) {
                            console.error('JinjaJS was unable to evaluate the statement: "' + condition + '"' +
                            ' in template ' + this.template);
                        }
                    }
                } else {
                    try {
                        if (eval(condition)) {
                            input = input.replace(ifBlock, branches[i].block);
                            trueStatementFound = true;
                            break;
                        }
                    } catch (error) {
                        console.error('JinjaJS was unable to evaluate the statement: "' + condition + '"' +
                        ' in template ' + this.template);
                    }
                }
            }

            // If no true statement was found, strip the entire if block.
            if (!trueStatementFound) {
                input = input.replace(ifBlock, '');
            }

            return input;
        };

        /**
         * Parses the {% render "template:path:jinja.js" %}
         *
         * @param input
         * @param data
         */
        this.parseRender = function (input, data) {
            // Partially match {% render "..." and iterate each match
            var myregexp = /\{% *render *"?[a-z0-9:._]+"? ?/gi;
            var match = myregexp.exec(input);

            while (match != null) {
                // Calculate full match
                var renderResult = "";
                var terminator = input.indexOf('%}', match.index) + 2;
                var fullMatch = input.substring(match.index, terminator);

                // Extract render template path
                var path = "";
                if (fullMatch.indexOf('"') != -1) {
                    path = fullMatch.replace(/\{% *render ?"/g, "");
                    path = path.substring(0, path.indexOf('"'));
                } else {
                    path = path = fullMatch.replace(/\{% *render ?/g, "").replace(/ ?%\}/, '');
                    with (data) {
                        path = eval(path);
                    }
                }

                // Get optional with clause, containing vars to pass to JinjaJs.render()
                if (fullMatch.indexOf(' with ') != -1) {
                    data = $.extend({}, $.parseJSON(fullMatch.split(" with ")[1].trim().replace(/ ?%\}/, '')), data);
                }

                // Replace the {% include ... %} tag with the result.
                while (input.indexOf(fullMatch) != -1) {
                    input = input.replace(fullMatch, JinjaJs.render(path, data).trim());
                }

                // Find next {% include ... %} tag
                newRegex = /\{% *render *"?[a-z0-9:._]+"? ?/gi; // Use a new RegExp instance...
                match = newRegex.exec(input);
            }
            return input;
        };

        /**
         *
         * @param input
         * @param data
         */
        this.parseInheritance = function (input, data) {
            matches = input.match(/\{% *extends *"[a-z0-9:._]+" *%\}/ig); // Matches {% extends "..." %}

            if (matches == null) {
                // No base to extend, simply return the input.
                return input;
            } else if (matches.length == 1) {
                // {% extends ... %} tag found. Now attempt to find and parse.

                // Extract base template name, for ex my:base:template.jinja extracted from {% extends ... %}
                var baseTemplate = matches[0]
                    .replace("{%", "").replace("%}", "").replace("extends", "").replace(" ", "").replace(/"/g, "").trim();
                var baseTemplatePath = this.getTemplatePath(baseTemplate);

                // Load the template.
                var template = $.ajax({async: false, url: baseTemplatePath}).responseText;

                // Find source {% block ... %}...{% endblock %} instances.
                var sourceBlocks = input.match(/\{%[ ]?block[ ]*[a-z0-9_]+[ ]?%\}(?:[\s\S]*?)\{%[ ]?endblock[ ]?%\}/ig);

                // Iterate source blocks, and replace target blocks in base template.
                for (var i in sourceBlocks) {
                    // Extract block name.
                    var name = sourceBlocks[i].replace(
                        /\{%[ ]?block[ ]*([a-z0-9_]+)[ ]?%\}(?:[\s\S])+\{%[ ]?endblock[ ]?%\}/ig, "$1");

                    // Extract body content inside {% block %}body-content{% endblock %}
                    var body = sourceBlocks[i].replace(
                        /\{%[ ]?block[ ]+[a-z0-9_]+[ ]?%\}|\{%[ ]?endblock[ ]?%\}/ig, "").trim();

                    // Replace here...
                    var regexp = new RegExp("\{% *block " + name + "[ ]?%\}([\s\S]*?)\{%[ ]?endblock[ ]?%\}", 'gi');
                    template = template.replace(regexp, body);
                }

                return template;
            } else if (matches.length >= 2) {
                console.error("JinjaJS has found multiple '{% extend' blocks in " + data._templatePath);
            }

            // Something probably went wrong?
            return undefined;
        };

        /**
         * Parses {% include 'module:controller' %} tags
         *
         * @param input
         * @param data
         */
        this.parseInclude = function (input, data) {
            // Partially match {% include "..." and iterate each match
            var myregexp = /\{% *include *"?[a-z0-9:._]+"? ?/gi;
            var match = myregexp.exec(input);

            while (match != null) {
                // Calculate full match
                var renderResult = "";
                var terminator = input.indexOf('%}', match.index) + 2;
                var fullMatch = input.substring(match.index, terminator);

                // Extract render template path
                var path = "";
                if (fullMatch.indexOf('"') != -1) {
                    path = fullMatch.replace(/\{% *include ?"/g, "");
                    path = path.substring(0, path.indexOf('"'));
                } else {
                    path = path = fullMatch.replace(/\{% *include ?/g, "").replace(/ ? %\}/, '');
                    with (data) {
                        path = eval(path);
                    }
                }

                // Get optional with clause, containing vars to pass to JinjaJs.render()
                if (fullMatch.indexOf(' with ') != -1) {
                    data = $.extend({}, $.parseJSON(fullMatch.split(" with ")[1].trim().replace(/ ?%\}/, '')), data);
                }

                // Build controller params
                var controllerName = path.substring(0, path.indexOf(':'));
                var actionName = path.substring(path.indexOf(':') + 1, path.lastIndexOf(':'));
                var parameters = [];

                // Execute the corresponding controller.
                var controller = new Controller();
                var response = controller.load(controllerName, actionName, data, false);
                var methodName = controllerName.toCamelCase() + actionName.ucFirst() + 'Action';
                if (window.hasOwnProperty(methodName)) {
                    renderResult = window[methodName](data);
                    delete window[methodName];
                } else {
                    throw new Error("Could not resolve controller method " + methodName + "!");
                }

                // Replace the {% include ... %} tag with the result.
                while (input.indexOf(fullMatch) != -1) {
                    input = input.replace(fullMatch, renderResult.trim());
                }

                // Find next {% include ... %} tag
                newRegex = /\{% *include *"?[a-z0-9:._]+"? ?/gi; // Use a new RegExp instance...
                match = newRegex.exec(input);
            }
            return input;
        };

        /**
         * Parses {{ variable }} place holders.
         *
         * @param input
         * @param data
         */
        this.parseVariables = function (input, data) {
            var regex = /\{\{ *[a-z0-9()_\.\[\]"']* *\}\}/gi;
            var match = regex.exec(input);

            // Merge data and config together.
            data = $.extend(data, this.global);

            while (match != null) {
                var expression = match[0].replace(/(\{\{ *)|( *\}\})/g, '');
                var result = '';
                try {
                    with (data) {
                        result = eval(expression);
                    }
                } catch (e) {
                    console.error('JinjaJs was unable to resolve ' + expression + ' in template ' + this.template);
                }

                // Replace the variable.
                var replaceRegex;
                if (expression.indexOf('()') != -1) {
                    replaceRegex =
                        new RegExp('\{\{ *' + expression.replace('(', '\\(').replace(')', '\\)') + ' *\}\}', 'g');
                } else {
                    replaceRegex =
                        new RegExp('\{\{ *' + expression.replace('[', '\\[').replace(']', '\\]') + ' *\}\}', 'g');
                }
                input = input.replace(replaceRegex, result);

                // Next regex match...
                newRegex = /\{\{ *[a-z0-9()_\.\[\]"']* *\}\}/gi; // New regex, force search from start.
                match = newRegex.exec(input);
            }

            return input;
        };

        /**
         * Renders a JinjaJs template.
         */
        this.render = function () {
            this.templatePath = this.getTemplatePath(this.template);
            var template = $.ajax({async: false, url: this.templatePath}).responseText;
            this.parsedTemplate = this.parse(template, this.data)
        };
    };

    // Public members...

    return {

        /**
         * Global variables we always want to be available in template will be added here.
         */
        global: {},

        /**
         * Renders a JinjaJS template.
         *
         * @param template
         * @param data
         * @param target jQuery target where result is placed
         *
         * @return string
         */
        render: function (template, data, target) {
            counter++;
            var result = "";
            var jinja = new JinjaParser(template, data, this.global);
            jinja.render();
            if (target != undefined) {
                result = $(target).html(jinja.getParsedTemplate());
            } else {
                result = jinja.getParsedTemplate();
            }
            if (--counter == 0) {
                $(window).trigger('render-complete');
            }
            return result;
        },

        /**
         * Includes a controller, using the given controller and action.
         *
         * @param controller
         * @param action
         * @param parameters
         */
        include: function (controller, action, parameters) {
            var result = null;
            var c = new Controller();
            c.load(controller, action, parameters, false);

            var methodName = controller + (action.replace('_', '')).ucFirst() + "Action";
            if (window.hasOwnProperty(methodName)) {
                result = window[methodName](parameters);
                delete window[methodName];
            } else {
                throw('Controller method ' + methodName + ' is undefined!');
            }
            return result;
        },

        /**
         * The addGlobal method is used to set a particular variable, and always make it available to the JinjaJS
         * parser. This is typically used to add configuration and application specific parameters, allowing these
         * values to transparently be available in any view template, without any extra code required.
         *
         * @param key
         * @param value
         */
        addGlobal: function (key, value) {
            this.global[key] = value;
        },

        /**
         * Returns a JinjaParser instance for testing purposes only.
         */
        _getTestParser: function (template, data) {
            return new JinjaParser(template, data);
        }
    }

})();
