#include <hbdebug.ch>
#include <hbmemvar.ch>

THREAD STATIC t_oSocketDebug := nil

#define CRLF e"\r\n"

PROCEDURE __dbgEntry( nMode, uParam1, uParam2, uParam3, uParam4 )
	local i, tmp, port := 6110 //TEMP
	switch nMode
   		CASE HB_DBG_GETENTRY

      		__dbgSetEntry()
      		exit

		CASE HB_DBG_ACTIVATE
			// if no server then start it.
			if(empty(t_oSocketDebug))
				hb_inetInit()
				t_oSocketDebug := hb_inetCreate()
				hb_inetTimeout( t_oSocketDebug,1000 )
				hb_inetConnect("127.0.0.1",port,t_oSocketDebug)
			endif
			if hb_inetErrorCode(t_oSocketDebug) <> 0
				//disconnected?
				OutErr(hb_inetErrorDesc(t_oSocketDebug)+CRLF)
   	  			__dbgSetGo( uParam1)
				return
			endif
			hb_inetSend(t_oSocketDebug,"STOP"+CRLF)
			do while .T.
				tmp := hb_inetRecvLine(t_oSocketDebug)
				if len(tmp)>0
					switch tmp
						case "GO"
							__dbgSetGo( uParam1)
							return
						case "STEP" // go to next line of code even if is in another procedure
							return
						case "NEXT" // go to next line of same procedure
							__dbgSetTrace(uParam1)
							return
						case "STACK" 
							sendStack(uParam3)
							exit
						case "LOCALS"
							sendFromStack(uParam3,hb_inetRecvLine(t_oSocketDebug),tmp,HB_DBG_CS_LOCALS)
							exit							
						case "STATICS"
							sendFromStack(uParam3,hb_inetRecvLine(t_oSocketDebug),tmp,HB_DBG_CS_STATICS)
							exit
						case "PRIVATES"
							sendVariables(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PRIVATE, .T., uParam3)
							exit
						case "PRIVATE_CALLEE"
							sendVariables(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PRIVATE, .F., uParam3)
							exit
						case "PUBLICS"
							sendVariables(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PUBLIC,, uParam3)
							exit
						//case "GLOBALS"
						//	sendVariables(HB_MV_PUBLIC,.F.)
						//	exit
						//case "EXTERNALS"
						//	sendVariables(HB_MV_PUBLIC,.F.)
						//	exit
					endswitch
				endif	
				hb_idleSleep(0.1)
			enddo

   			exit
			
	ENDSWITCH

static procedure sendStack(aStack)
	local i, j, tmp, vv
	hb_inetSend(t_oSocketDebug,"STACK " + alltrim(str(len(aStack)))+CRLF)
	for i:=1 to len(aStack)
		hb_inetSend(t_oSocketDebug, aStack[i,HB_DBG_CS_MODULE]+ ;
			":"+alltrim(str(aStack[i,HB_DBG_CS_LINE]))+ ;
			":"+aStack[i,HB_DBG_CS_FUNCTION]+CRLF)
	next

static function format(value)
	switch valtype(value)
		case "U"
			return "nil"
			exit
		case "C"
			return value
			exit
		case "N"
			return alltrim(str(value))
			exit
		case "L"
			return iif(value,"true","false")
			exit
		case "A"
		case "H"
			return alltrim(str(len(value)))
			exit
		endswitch
return ""

static procedure sendFromStack(aStack,cParams,prefix,DBG_CS)
	local i, aParams := hb_aTokens(cParams,":")
	local iStack := val(aParams[1])
	local iStart := val(aParams[2])
	local iCount := val(aParams[3])
	local aInfo, value, cLine 
	iStack:= iif(iStack>len(aStack)	, len(aStack)	, iStack)
	iStack:= iif(iStack<1			, 1				, iStack)
	iStart:= iif(iStart>len(aStack[iStack,DBG_CS]),len(aStack[iStack,DBG_CS]) , iStart )
	iStart:= iif(iStart<1			, 1				, iStart )
	iCount:= iif(iCount<1			, len(aStack[iStack,DBG_CS]), iCount )
	hb_inetSend(t_oSocketDebug,prefix+" "+alltrim(str(iStack))+CRLF)
	for i:=iStart to iStart+iCount
		if(i>len(aStack[iStack,DBG_CS]))
			exit
		endif
		aInfo := aStack[iStack,DBG_CS,i]
		value := __dbgVMVarLGet( __dbgProcLevel() - aInfo[ HB_DBG_VAR_FRAME ], aInfo[ HB_DBG_VAR_INDEX ] )
		cLine := alltrim(str(i)) + ":" + alltrim(str(aInfo[ HB_DBG_VAR_INDEX ])) + ":" +;
				  aInfo[HB_DBG_VAR_NAME] + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oSocketDebug,cLine + CRLF )
	next
	hb_inetSend(t_oSocketDebug,"END"+CRLF)

procedure sendVariables(prefix, cParams, HB_MV, lLocal,aStack)
	local i, aParams := hb_aTokens(cParams,":"), cLine, cName, value
	local iStack := val(aParams[1])
	local iStart := val(aParams[2])
	local iCount := val(aParams[3])
	local nVars := __mvDbgInfo( HB_MV )
	local nLocal
	iStack:= iif(iStack>len(aStack)	, len(aStack)	, iStack)
	iStack:= iif(iStack<1			, 1				, iStack)
	iStart:= iif(iStart>nVars		, nVars 		, iStart )
	iStart:= iif(iStart<1			, 1				, iStart )
	iCount:= iif(iCount<1			, nVars			, iCount )
	nLocal := __mvDbgInfo( HB_MV_PRIVATE_LOCAL, aStack[iStack,HB_DBG_CS_LEVEL] )
	hb_inetSend(t_oSocketDebug,prefix+" "+alltrim(str(iStack))+CRLF)
	for i:=iStart to iStart+iCount
	//for i:=1 to nVars
		if i > nVars
			loop
		endif
		if HB_MV = HB_MV_PRIVATE 
			if lLocal .and. i>nLocal
				loop
			endif
			if .not.  lLocal .and. i<=nLocal
				loop
			endif
		endif
		value := __mvDbgInfo( HB_MV, i, @cName )
		cLine := alltrim(str(i)) + ":" + alltrim(str(i)) + ":" +;
				  cName + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oSocketDebug,cLine + CRLF )
	next

	hb_inetSend(t_oSocketDebug,"END"+CRLF)	


//*/
proc main()
	local i
	AltD()
	? "Perry"
	AltraFunzione()
	? i:=2
	? i
return

proc AltraFunzione()
	local p := "sei fuori"
	local a := {1,2,3}
	memvar test,test2
	public test := "non io"
	private test2 := "altro"
	Called()
	? p
	? "più righe"
	? "per provare"
return

proc Called()
	memvar test2
	? test2
	

/* notes from src/debug/debugger.prg:
	__DbgEntry ACTIVATE -> breakpoint arrived,
			default there is a breakpoint at startup, without 'go' next line is a breakpoint, 
				if 'trace' next line even if is inside a called procedure is a breakpoint
		uParam1 --> debugInfo
	
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


