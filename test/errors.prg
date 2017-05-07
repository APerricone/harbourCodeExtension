/** PERRY */

#include <hbclass.ch>

class oggetto
   METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )
endclass

proc test()
	LOCAL i:= 1
	i += 2
	? i
return
/*
eceived:initialize
Send:{"jsonrpc":"2.0","id":0,"result":{"capabilities":{"textDocumentSync":"documents.syncKind"}}}
received:textDocument/didOpen

Error BASE/1133  Bound error: array assign
Called from PARSE(96)  
Called from PROCESS(60)  
Called from MAIN(30)  [Info  - 13:17:26] Connection to server got closed. Server will restart.*/