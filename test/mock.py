from bottle import route, run, template
import json
from bottle import response
from bottle import request

@route('/debug', method=['OPTIONS', 'POST'])
def debug(): 
    print(json.loads(request.body.read().decode('utf-8')))
    
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS, FETCH'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'
    return json.dumps({
        "code" : "ok"
    })
    
@route('/add', method=['OPTIONS', 'POST'])
def add(): 
    print(json.loads(request.body.read().decode('utf-8')))
    
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS, FETCH'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'
    return json.dumps({
        "code" : "ok"
    })


@route('/mock')
def index():
    rv = [
        {
            "line": 3,
            "lineContent": "",
            "comment": "这个是第3行备注"
        },
        {
            "line": 14,
            "lineContent": "",
            "comment": "这个是第14行备注"
        },
        {
            "line": 21,
            "lineContent": "",
            "comment": "这个是第21行备注"
        },
        {
            "line": 90,
            "lineContent": "",
            "comment": "这个是第90行备注"
        },
        {
            "line": 65,
            "lineContent": "",
            "comment": "这个是第65行备注"
        },
        {
            "line": 145,
            "lineContent": "",
            "comment": "这个是第145行备注"
        }
    ]
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS, FETCH'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'
    return json.dumps(rv)


run(host='127.0.0.1', port=8080)
