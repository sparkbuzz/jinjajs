$(document).ready(function(){

    module("JinjaJs");

    /**
     * Tests initialization of the JinjaParser private class.
     */
    test("JinjaParser Initialization Test", function() {
        var jinja = JinjaJs._getTestParser('my:base:template.jinja', {data: 'test-data'});

        equal(jinja.template, 'my:base:template.jinja');
        equal(jinja.templatePath, undefined);
        deepEqual(jinja.data, {data: 'test-data'});
        equal(jinja.parsedTemplate, undefined);
    });

    /**
     * Tests JinjaParser.getTemplatePath
     */
    test("JinjaParser.getTemplatePath", function() {
        var jinja = JinjaJs._getTestParser('my:base:template.jinja', {data: 'test-data'});

        equal(jinja.getTemplatePath('my:base:template.jinja'), 'js/jinjajs/modules/my/base/view/template.jinja');
    });

    /**
     * Tests JinjaParser.parseVariables
     */
    test("JinjaParser.parseVariables", function() {
        var jinja = JinjaJs._getTestParser();
        var data = "";

        // Test simple variables, with and without whitespace in template.
        data = {
            myVariable1: "simple test1",
            myVariable2: "simple test2",
            myVariable3: "simple test3"
        };
        equal(
            jinja.parseVariables('This is a {{ myVariable1 }}!', data),
            "This is a simple test1!"
        );
        equal(
            jinja.parseVariables('This is a {{myVariable2}}!', data),
            "This is a simple test2!"
        );
        equal(
            jinja.parseVariables('This is a {{    myVariable3    }}!', data),
            "This is a simple test3!"
        );

        // Variables must resolve for multiple instances.
        equal(
            jinja.parseVariables("{{ myVariable1 }} {{ myVariable2 }} {{ myVariable3 }}", data),
            "simple test1 simple test2 simple test3"
        );

        // Test with object properties, with and without whitespace in template.
        var data = {
            object: {
                value: "complex test"
            }
        };
        equal(
            jinja.parseVariables('This is a more {{ object.value }}!', data),
            "This is a more complex test!"
        );
        equal(
            jinja.parseVariables('This is a more {{object.value}}!', data),
            "This is a more complex test!"
        );
        equal(
            jinja.parseVariables('This is a more {{    object.value    }}!', data),
            "This is a more complex test!"
        );

        // Must also be able to evaluate simple getter methods.
        var data = {
            item: {
                name: "Bananarama",
                getSerial: function() {
                    return '12345-12345';
                }
            }
        };
        equal(
            jinja.parseVariables("Object name is {{ item.name }}", data),
            "Object name is Bananarama"
        );
        equal(
            jinja.parseVariables("Object serial is {{ item.getSerial() }}", data),
            "Object serial is 12345-12345"
        );
    });

    /**
     * Tests JinjaParser.parseControlStructures with if statements.
     */
    test("JinjaParser.parseIf", function(){
        var jinja = JinjaJs._getTestParser();
        var data = {
            boolean: true,
            strValue: 'test'
        };
        var input ="";

        // Test simple {% if ... %} block
        $.ajax({
            async: false,
            url: 'assets/if_001.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "data.boolean == true; data.strValue == 'test'; compound test passed;This if is ignored..."
        );

        // Test simple single liner {% if ... %} block
        $.ajax({
            async: false,
            url: 'assets/if_002.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, ''),
            "data.boolean == true;data.strValue == 'test';compound test passed;"
        );

        // Test with {% else if ... %} block
        $.ajax({
            async: false,
            url: 'assets/if_003.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "<p>Test passed!</p> <p>Test passed again!</p> <p>Else test passed!</p>"
        );

        // Test with {% else if ... %} block
        $.ajax({
            async: false,
            url: 'assets/if_004.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "<p>Nested test passed!</p> <p>Nested test passed, again!</p> <p>Nested test, else passed!</p>"
        );

    });

    /**
     * Tests JinjaParser.parseControlStructures with for loop statements.
     */
    test("JinjaParser.parseFor", function(){
        var jinja = JinjaJs._getTestParser();
        var input = "";

        var data = {
            items: ['apple', 'banana', 'cranberry']
        };

        // Test simple {% for ... %} block
        $.ajax({
            async: false,
            url: 'assets/for_001.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).trim(),
            "<div>apple</div><div>banana</div><div>cranberry</div>"
        );

        // Test more complex {% for ... %} block
        data = {
            items: [
                {label: "Apples", color: "red"},
                {label: "Bananas", color: "yellow"},
                {label: "Oranges", color: "orange"}
            ]
        };
        $.ajax({
            async: false,
            url: 'assets/for_002.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).trim(),
            "<div>Apples are red.</div><div>Bananas are yellow.</div><div>Oranges are orange.</div>"
        );

        // Test more complex {% for ... %} block with nested if statements
        data = {
            items: [
                {label: "Apples", color: "red", visible: false},
                {label: "Bananas", color: "yellow", visible: true},
                {label: "Oranges", color: "orange", visible: true}
            ]
        };
        $.ajax({
            async: false,
            url: 'assets/for_003.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "<div>Bananas are yellow.</div><div>Oranges are orange.</div>"
        );

        // Test nested {% for ... %} statements.
        data = {
            rows: [
                {columns: [1, 2, 3, 4, 5]},
                {columns: [1, 2, 3, 4, 5]},
                {columns: [1, 2, 3, 4, 5]},
                {columns: [1, 2, 3, 4, 5]},
                {columns: [1, 2, 3, 4, 5]},
            ]
        };
        $.ajax({
            async: false,
            url: 'assets/for_004.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "[1][2][3][4][5][1][2][3][4][5][1][2][3][4][5][1][2][3][4][5][1][2][3][4][5]"
        );

        // Test nested {% for ... %} statements and "{% for items in contents[box.contents] %}".
        data = {
            boxes: [
                {serial: "001", contents: "fruit"},
                {serial: "002", contents: "vegetables"}
            ],
            contents: {
                fruit: ["Apples", "Bananas", "Strawberries"],
                vegetables: ["Carrots", "Peas", "Onions"]
            }
        };
        $.ajax({
            async: false,
            url: 'assets/for_005.jinja',
            success: function(response) {
                input = response;
            }
        });
        equal(
            jinja.parseControlStructures(input, data).replace(/\r\n|\n|\r/g, '').replace(/\s{2,}/g, ' ').trim(),
            "001 contains [Apples][Bananas][Strawberries]002 contains [Carrots][Peas][Onions] ...done..."
        );
    });

    /**
     * Tests JinjaParser.parseInheritance
     */
    test("JinjaParser.parseInheritance", function(){
        var jinja = JinjaJs._getTestParser();
        var template = "";
        var expected = "";

        // Check successful inheritance
        $.ajax({
            async: false,
            url: 'assets/extends.jinja',
            success: function(response) {
                template = response;
            }
        });
        $.ajax({
            async: false,
            url: 'assets/extends-expected.jinja',
            success: function(response) {
                expected = response
            }
        });

        equal(jinja.parseInheritance(template), expected);
    });

    /**
     * Tests JinjaParser.parseInclude
     */
    test("JinjaParser.parseInclude without variables", function(){
        var jinja = JinjaJs._getTestParser();
        var input = "";
        var expected = "";

        $.ajax({
            async: false,
            url: 'assets/include1.jinja',
            success: function(response){
                input = response;
            }
        });
        $.ajax({
            async: false,
            url: 'assets/include-expected1.jinja',
            success: function(response){
                expected = response;
            }
        });

        equal(jinja.parseInclude(input), expected);
    });

    /**
     * Tests JinjaParser.parseInclude including with statement.
     */
    test("JinjaParser.parseInclude with variables", function(){
        var jinja = JinjaJs._getTestParser();
        var input = "";
        var expected = "";

        $.ajax({
            async: false,
            url: 'assets/include2.jinja',
            success: function(response){
                input = response;
            }
        });
        $.ajax({
            async: false,
            url: 'assets/include-expected2.jinja',
            success: function(response){
                expected = response;
            }
        });

        equal(jinja.parseInclude(input), expected);
    });

    /**
     * Tests JinjaParser.parseRender
     */
    test("JinjaParse.parseRender without variables", function(){
        var jinja = JinjaJs._getTestParser();
        var input = "";
        var expected = "";

        $.ajax({
            async: false,
            url: 'assets/render1.jinja',
            success: function(response){
                input = response;
            }
        });
        $.ajax({
            async: false,
            url: 'assets/render-expected1.jinja',
            success: function(response){
                expected = response;
            }
        });

        equal(jinja.parseRender(input), expected);
    });

    /**
     * Tests JinjaParser.parseRender
     */
    test("JinjaParse.parseRender with variables", function(){
        var jinja = JinjaJs._getTestParser();
        var input = "";
        var expected = "";

        $.ajax({
            async: false,
            url: 'assets/render2.jinja',
            success: function(response){
                input = response;
            }
        });
        $.ajax({
            async: false,
            url: 'assets/render-expected2.jinja',
            success: function(response){
                expected = response;
            }
        });

        equal(jinja.parseRender(input, {message: "Qunit is fun!"}), expected);
    });
});
