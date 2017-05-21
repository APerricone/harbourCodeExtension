#include <hbdebug.ch>

THREAD STATIC t_oSocketDebug := nil

#define CRLF Chr(13)+Chr(10)

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
				? "connected!"
			endif
			if hb_inetErrorCode(t_oSocketDebug) <> 0
				//disconnected?
   	  			__dbgSetGo( uParam1)
				return
			endif
			do while .T.
				tmp := hb_inetRecvLine(t_oSocketDebug)
				if len(tmp)>0
					? "received:"+tmp
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
							hb_inetSend(t_oSocketDebug,"STACK " + alltrim(str(len(uParam3)))+CRLF)
							for i:=1 to len(uParam3)
								hb_inetSend(t_oSocketDebug, uParam3[i,HB_DBG_CS_MODULE]+ ;
									":"+alltrim(str(uParam3[i,HB_DBG_CS_LINE]))+":"+uParam3[i,HB_DBG_CS_FUNCTION]+CRLF)
							next
						exit
					endswitch
				endif	
				hb_idleSleep(0.1)
			enddo				

   	  		//for i:=1 to len(uParam3)
   	  		//	? "Stack " + alltrim(str(i))+":"+uParam3[i,HB_DBG_CS_MODULE]+"-"+uParam3[i,HB_DBG_CS_FUNCTION]+;
   	  		//		"("+alltrim(str(uParam3[i,HB_DBG_CS_LINE]))+")*"+alltrim(str(uParam3[i,HB_DBG_CS_LEVEL]))
   	  		//next
			exit
			
	ENDSWITCH

//*/
proc main()
	local i
	? "Perry"
	
	? i:=2
	? i
	
return

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

