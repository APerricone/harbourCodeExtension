/// Add some line empty
/// it is necessary to test the offset
/// of modules inside the harbourd debug
/// system.
/// no code unltil line 14
/// include, static are not code :)

///OK
#include <hbclass.ch>
#include <hbmacro.ch>

STATIC TestStatic_file
MEMVAR t_aGlobal

class oggetto
protected:
   	DATA soo INIT {1=>"one", 2=>"two",3=>"three"}
exported:
   	DATA noo AS NUMERIC
   	DATA ioo, rdefrr
	classDATA newData INIT "newData"
   	METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )
   	METHOD otherMedhod()
endclass

METHOD otherMedhod() CLASS oggetto
	local test:= ::soo
	if empty(::soo)
		::soo := "nil"
	endif
return ::soo + " " + str(::noo)

class figlio inherit oggetto
	data dFiglio INIT {^ 2018/12/20 }
	data zz INIT "Antonino Perricone"
	constructor new()
endclass

METHOD new() class figlio
	::soo := {"old"=>::soo,4=>"four",5=>"five",6=>"six"}
return Self

PROC MyErrorBlock(e)
	? "ERRORISSIMO "

func test(a,b)
return a+b

proc main( )
	local i as numeric, j := Do("test",3,4)
	local c := figlio():New()
	local bs := "{|a,c| QOut(c:otherMedhod()) }"
	loca b := {|c| QOut(c:otherMedhod()) }
	STAT TestStatic, TestStatic2
	//memvar i,j
	//ErrorBlock({|e| MyErrorBlock(e) })
	TestStatic_File := oggetto():New() //{1,1,2,3,5,8,13,21,34,55,89,144}
	TestStatic_File:ioo := {"prova"=>{"val1"=>"val","val2"=>"valval"}}
	c:ioo := {"prova"=>{"val1"=>"val","val2"=>"valval"}}
	TestStatic2 := {1,1,2,3,5,8,13,21,34,55,89,144}
	? "S",valtype(TestStatic),valtype(TestStatic2)
	c:newData := {1,2,3,4,5}
	c:ioo := oggetto():New()
	c:ioo:newData := {6,7,8,9,10}
	hb_SetMacro( HB_SM_HARBOUR,  .T. )
	for i:=1 to 10
		j:=i*2
		? "i vale &( str(i) ), j vale &(j), formula &(i*2)"
	next
	AltD()
	? "Perry"
	//begin sequence with {|| QOut("eh") }
	//	eval(&bs,"",c)
	//end sequence
	//eval(b,"",c)
	AltraFunzione()
	? i:=2
	? i
	eval(&("{|| TestLib() }"))
	testLotParameter(1,[2,3],{4,5},"6,7",'A,2',;
		"PROVA,TEST","Pippo",{6,5,3,2,1},234 ;
			)
	for i:=1 to 10
		? i
	next
return

// Another function, it is to test the comment with //
func AltraFunzione( )
	local p := "sei fuori"
	local a := {{'ciao'=>'belli'},{20,10},"AAA"}
	memvar test,test2,hh
	public test := {"non io"}
	public hh := {'pp'=>3,'pi'=>3.14,4=>{1,2}}
	private test2 := {"altro"} //unused
	a[1,{^ 2018/12/22 }] := 'date with expressions'
	Called()
	? p
	? "più righe"
	? "per provare"
return a

* Called by who?
proc Called()
	memvar test2
	local timeStamp1 := {^ 1978/11/06 17:10:23.324 }
	//local date := d"2017/05/23"
	//local timeStamp2 := t"14:00"
	local test := "1978-06-11 17:10:23.324"
	static provaStat := 611
	? test2

NOTE Testing a lib
proc TestLib()
	LOCAL bb := {|| TestLibInside()}
	FakeLib(bb)

/* Multi line comment
	Test with empty line too
*/
proc TestLibInside()
	LOCAL bb := {|a| TestLibInside2(a)}
	FakeLib(bb,4)

* Multi line with asterisc
* Another line
proc TestLibInside2(v)
	LOCAL a := "a"
	LOCAL arr := {4,3,2,1}
	? a,v

proc testLotParameter(a/*a param*/,b/*b param*/,c/*c param*/,;
			d/*d param*/,e/*e param*/,f ; //f param
			,g,h,i,j,k,l,m,n,o,p,q,r)
return

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


