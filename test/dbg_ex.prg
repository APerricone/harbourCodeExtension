#include <hbdebug.ch>
#include <hbmemvar.ch>
//*
PROCEDURE __dbgEntry( nMode, uParam1, uParam2, uParam3, uParam4 )
	local i, tmp, j, vv
	? "__dbgEntry", nMode,":", uParam1,"-", uParam2,"-", uParam3,"-", uParam4 
   
	switch nMode
   		CASE HB_DBG_GETENTRY

      		__dbgSetEntry()
      		exit

		CASE HB_DBG_ACTIVATE
			//__dbgSetTrace(uParam1)
			? "level:",__dbgProcLevel()
   	  		for i:=1 to len(uParam3)
   	  			? "Stack " + alltrim(str(i))+":"+uParam3[i,HB_DBG_CS_MODULE]+"-"+uParam3[i,HB_DBG_CS_FUNCTION]+;
   	  				"("+alltrim(str(uParam3[i,HB_DBG_CS_LINE]))+")*"+alltrim(str(uParam3[i,HB_DBG_CS_LEVEL]))+;
					" "+alltrim(str(len(uParam3[i,HB_DBG_CS_LOCALS])))+" locals, ";	 
					+alltrim(str(len(uParam3[i,HB_DBG_CS_STATICS])))+" statics, "
				for j:=1 to len(uParam3[i,HB_DBG_CS_LOCALS])
					tmp := uParam3[i,HB_DBG_CS_LOCALS,j]
					vv := __dbgVMVarLGet( __dbgProcLevel() - tmp[ HB_DBG_VAR_FRAME ], tmp[ HB_DBG_VAR_INDEX ] )
					? "Local " + alltrim(str(i))+":#" + alltrim(str(tmp[HB_DBG_VAR_INDEX])) + ;
						tmp[HB_DBG_VAR_NAME] + "("+tmp[HB_DBG_VAR_TYPE]+":" + ;
						alltrim(str(tmp[HB_DBG_VAR_FRAME])) + ") " + valtype(vv), ; 
						vv
				next
				? "HB_MV_PRIVATE_LOCAL", __mvDbgInfo( HB_MV_PRIVATE_LOCAL, uParam3[i,HB_DBG_CS_LEVEL])
   	  		next
   	  		for i:=1 to len(uParam4)
   	  			? "Module " + alltrim(str(i))+":"+uParam4[i,HB_DBG_MOD_NAME]+ ;
   	  				" "+alltrim(str(len(uParam4[i,HB_DBG_MOD_STATICS])))+" statics, ";
					+alltrim(str(len(uParam4[i,HB_DBG_MOD_GLOBALS])))+" globals,"
   	  		next
			tmp := __dbgGetSourceFiles(uParam1)
   	  		for i:=1 to len(tmp)
   	  			? "File " + alltrim(str(i))+":" + tmp[i]
   	  		next
		exit	
	ENDSWITCH

//*/
proc main()
	local i
	AltD()
	? "Perry"
	AltraFunzione()
	? i:=2
	? i
return

proc AltraFunzione
	local p := "sei fuori"
	local a := [1,2,3]
	memvar test
	private test := "non io"
	? p
	? "più righe"
	? "per provare"
return

/* notes from src/debug/debugger.prg:
	__DbgEntry ACTIVATE -> breakpoint arrived,
			default there is a breakpoint at startup, without 'go' next line is a breakpoint, 
				if not 'trace' next line even if is inside a called procedure is a breakpoint
		uParam1 --> debugInfo
	
	Commands:
		__dbgSetGo(debugInfo) --> play the program
		__dbgSetTrace(debugInfo) --> if called does not enter inside the next call
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
   recap:
   localVariable: __dbgVMVarLGet(level,idx)   --> LOC:LEVEL:IDX
   staticVariable: __dbgVMVarSGet(level,idx)  --> STA:LEVEL:IDX
   privateVariable: __mvDbgInfo(HB_MV_PRIVATE,idx) --> PRI:IDX
   publicVariable: __mvDbgInfo(HB_MV_PUBLIC,idx)   --> PUB:IDX
*/

