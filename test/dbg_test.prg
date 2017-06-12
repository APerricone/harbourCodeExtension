#include <hbclass.ch>

class oggetto
   	DATA soo AS STRING
   	DATA noo AS NUMERIC
   	DATA ioo
	DATA newData
   	METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )
   	METHOD otherMedhod()
endclass

METHOD otherMedhod() CLASS oggetto
	local test := ::soo
	if empty(::soo)
		::soo := "nil"
	endif
return ::soo + " " + str(::noo)


proc main()
	local i as numeric
	local c := oggetto():New()
	local bs := "{|a,c| QOut(c:otherMedhod()) }"
	local b := {|a,c| QOut(c:otherMedhod()) }
	AltD()
	? "Perry"
	eval(&bs,"",c)
	//eval(b,"",c)
	AltraFunzione()
	? i:=2
	? i
return

func AltraFunzione()
	local p := "sei fuori"
	local a := {{'pp'=>3,'pi'=>3.14},{20,10},"AAA"}
	memvar test,test2
	public test := "non io"
	private test2 := "altro"
	Called()
	? p
	? "più righe"
	? "per provare"
return a

proc Called()
	memvar test2
	local timeStamp1 := {^ 1978-06-11 17:10:23.324 }
	local date := d"2017-05-23"
	local timeStamp2 := t"14:00"
	local test := "1978-06-11 17:10:23.324"
	? test2
	

/* notes from src/debug/debugger.prg:
	__DbgEntry ACTIVATE -> breakpoint arrived,
			default there is a breakpoint at startup, without 'go' next line is a breakpoint, 
				if 'trace' next line even if is inside a called procedure is a breakpoint
		uParam1 --> debugInfo

		__dbgInvokeDebug() if .T. it stopped is caused by an AltD()

	
	Commands:
		__dbgSetGo(debugInfo) --> play the program
		__dbgSetTrace(debugInfo) --> set a breakpoint in the first line of the next called procedure
		__dbgSetCBTrace(debugInfo,lCB) --> trace includes codeblock too
		__dbgAddBreak(debugInfo,file,line) --> 
		__dbgIsBreak(debugInfo,file,line) --> return id of breakpoint if setted
		__dbgDelBreak(debugInfo, id)
		__dbgAddWatch(debugInfo,cExpr,lTracePoint) --> 
      	__mvDbgInfo( HB_MV_PUBLIC|HB_MV_PRIVATE ) --> returns number of public/private variable
      	__mvDbgInfo( HB_MV_PUBLIC|HB_MV_PRIVATE, idx, @cName ) -> returns the index of idx public variable (Sets its name in cName)
      	__mvDbgInfo( HB_MV_PRIVATE_LOCAL, lv ) -> returns number of private variable at level lv of stack
		__dbgProcLevel() --> return the current level (len of stack?)
		      	
		gets of value of variable
		   SWITCH aVar[ HB_DBG_VAR_TYPE ]
   CASE "G" ; RETURN __dbgVMVarGGet( aVar[ HB_DBG_VAR_FRAME ], aVar[ HB_DBG_VAR_INDEX ] )
   CASE "L" ; RETURN __dbgVMVarLGet( __dbgProcLevel() - aVar[ HB_DBG_VAR_FRAME ], aVar[ HB_DBG_VAR_INDEX ] )
   CASE "S" ; RETURN __dbgVMVarSGet( aVar[ HB_DBG_VAR_FRAME ], aVar[ HB_DBG_VAR_INDEX ] )
   ENDSWITCH

*/


