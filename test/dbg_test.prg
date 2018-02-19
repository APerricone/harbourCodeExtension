/// Add some line empty
/// it is necessary to test the offset 
/// of modules inside the harbourd debug
/// system.
/// no code unltil line 14
/// include, static are not code :)


///OK
#include <hbclass.ch>

STATIC TestStatic

class oggetto
protected:
   	DATA soo AS STRING
exported:
   	DATA noo AS NUMERIC
   	DATA ioo, rdefrr
	DATA newData
   	METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )
   	METHOD otherMedhod()
endclass

METHOD otherMedhod() CLASS oggetto
	local test:= ::soo
	if empty(::soo)
		::soo := "nil"
	endif
return ::soo + " " + str(::noo)

proc main( )
	local i as numeric
	local c := oggetto():New()
	local bs := "{|a,c| QOut(c:otherMedhod()) }"
	local b := {|c| QOut(c:otherMedhod()) }
	STATIC TestStatic, TestStatic2
	TestStatic := {1,1,2,3,5,8,13,21,34,55,89,144}
	TestStatic2 := {1,1,2,3,5,8,13,21,34,55,89,144}
	c:newData := {1,2,3,4,5}
	c:ioo := oggetto():New()
	c:ioo:newData := {6,7,8,9,10}
	AltD()
	? "Perry"
	eval(&bs,"",c)
	//eval(b,"",c)
	AltraFunzione()
	? i:=2
	? i
	eval(&("{|| TestLib() }"))
return

func AltraFunzione( )
	local p := "sei fuori"
	local a := {{'ciao'=>'belli'},{20,10},"AAA"}
	memvar test,test2,hh
	public test := {"non io"}
	public hh := {'pp'=>3,'pi'=>3.14,4=>{1,2}}
	private test2 := {"altro"}
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
	

proc TestLib()
	LOCAL bb := {|| TestLibInside()}
	FakeLib(bb)

proc TestLibInside()
	LOCAL bb := {|a| TestLibInside2(a)}
	FakeLib(bb,4)

proc TestLibInside2(v)
	LOCAL a := "a"
	? a,v

#pragma -B-
proc FakeLib(bBlock,par)
	eval(bBlock, par)

#pragma -B+

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


