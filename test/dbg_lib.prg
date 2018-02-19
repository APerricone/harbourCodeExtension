// DO NOT REMOVE THIS PRAGMA
// if the debugger code has DEBUGINFO the program will crash for stack overflow 
#pragma DEBUGINFO=Off

#include <hbdebug.ch>
#include <hbmemvar.ch>
#include <hboo.ch>
#include <hbclass.ch>

#define CRLF e"\r\n"
#ifndef DBG_PORT
// Temp, I hope to find another way to do InterProcessCommunication that uses ProcessId as unique key
// in the meanwhile, you can change the port using compiler command line argumend -D to set DBG_PORT
// to another value, it is useful if you need to debug 2 programm in the same time.
#define DBG_PORT 6110
#endif

// returns .T. if need step
static procedure CheckSocket(lStopSent) 
	LOCAL tmp
	LOCAL t_oDebugInfo := __DEBUGITEM()
	lStopSent := iif(empty(lStopSent),.F.,lStopSent)
	// if no server then start it.
	if(empty(t_oDebugInfo['socket']))
		hb_inetInit()
		t_oDebugInfo['socket'] := hb_inetCreate()
		hb_inetTimeout( t_oDebugInfo['socket'],1000 )
		hb_inetConnect("127.0.0.1",DBG_PORT,t_oDebugInfo['socket'])
	endif
	do while .T.
		//if hb_inetErrorCode(oSocket) <> 0
		//	//disconnected?
		//	OutErr(hb_inetErrorDesc(oSocket)+CRLF)
		//	t_oDebugInfo['lRunning'] := .T.
		//	t_oDebugInfo['aBreaks'] := {=>}
		//	t_oDebugInfo['maxLevel'] := nil
		//	return 
		//
		if hb_inetDataReady(t_oDebugInfo['socket']) = 1
			tmp := hb_inetRecvLine(t_oDebugInfo['socket'])
		else
			tmp := ""
		endif
		if len(tmp)>0
			//? "<<", tmp
			if subStr(tmp,4,1)==":"
				sendCoumpoundVar(tmp, hb_inetRecvLine(t_oDebugInfo['socket']))
				loop
			endif
			switch tmp
				case "PAUSE"
					t_oDebugInfo['lRunning'] := .F.
					if .not. lStopSent
						hb_inetSend(t_oDebugInfo['socket'],"STOP:pause"+CRLF)
						lStopSent := .T.
					endif
					exit
				case "GO"
					t_oDebugInfo['lRunning'] := .T.
					return
				case "STEP" // go to next line of code even if is in another procedure
					t_oDebugInfo['lRunning'] := .F.
					return
				case "NEXT" // go to next line of same procedure
					t_oDebugInfo['lRunning'] := .T.
					t_oDebugInfo['maxLevel'] := __dbgProcLevel()
					return
				case "EXIT" // go to callee procedure
					t_oDebugInfo['lRunning'] := .T.
					t_oDebugInfo['maxLevel'] := __dbgProcLevel() -1
					return
				case "STACK" 
					sendStack()
					exit
				case "BREAKPOINT"
					setBreakpoint(hb_inetRecvLine(t_oDebugInfo['socket']))
					exit
				case "LOCALS"
					sendFromStack(hb_inetRecvLine(t_oDebugInfo['socket']),tmp,HB_DBG_CS_LOCALS)
					exit							
				case "STATICS"
					sendFromStack(hb_inetRecvLine(t_oDebugInfo['socket']),tmp,HB_DBG_CS_STATICS)
					exit
				case "PRIVATES"
					sendFromInfo(tmp,hb_inetRecvLine(t_oDebugInfo['socket']),HB_MV_PRIVATE, .T.)
					exit
				case "PRIVATE_CALLEE"
					sendFromInfo(tmp,hb_inetRecvLine(t_oDebugInfo['socket']),HB_MV_PRIVATE, .F.)
					exit
				case "PUBLICS"
					sendFromInfo(tmp,hb_inetRecvLine(t_oDebugInfo['socket']),HB_MV_PUBLIC)
					exit
				//case "GLOBALS"
				//	sendVariables(HB_MV_PUBLIC,.F.)
				//	exit
				//case "EXTERNALS"
				//	sendVariables(HB_MV_PUBLIC,.F.)
				//	exit
				case "EXPRESSION"
					sendExpression(hb_inetRecvLine(t_oDebugInfo['socket']))
					exit
			endswitch
		else
			if t_oDebugInfo['lRunning']
				if inBreakpoint()
					t_oDebugInfo['lRunning'] := .F.
					if .not. lStopSent
						hb_inetSend(t_oDebugInfo['socket'],"STOP:break"+CRLF)
						lStopSent := .T.
					endif
				endif
				if __dbgInvokeDebug(.F.)
					t_oDebugInfo['lRunning'] := .F.
					if .not. lStopSent
						hb_inetSend(t_oDebugInfo['socket'],"STOP:AltD"+CRLF)
						lStopSent := .T.
					endif
				endif
				if .not. empty(t_oDebugInfo['maxLevel']) 
					if t_oDebugInfo['maxLevel'] < __dbgProcLevel()
						// we are not in the same procedure
						return
					endif
					t_oDebugInfo['maxLevel'] := nil
					t_oDebugInfo['lRunning'] := .F.
					if .not. lStopSent
						hb_inetSend(t_oDebugInfo['socket'],"STOP:next"+CRLF)
						lStopSent := .T.
					endif
				endif
			endif
			if t_oDebugInfo['lRunning'] 
				return
			endif
			if .not. lStopSent
				hb_inetSend(t_oDebugInfo['socket'],"STOP:step"+CRLF)
				lStopSent := .T.
			endif
			hb_idleSleep(0.1)
		endif	
	enddo
	// unreachable code
return

static procedure sendStack() 
	local i,d
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local aStack := t_oDebugInfo['aStack']
	hb_inetSend(t_oDebugInfo['socket'],"STACK " + alltrim(str(len(aStack)))+CRLF)
	d := __dbgProcLevel()
	for i:=len(aStack) to 1 step -1
		aStack[i,HB_DBG_CS_LINE] := procLine(d-aStack[i,HB_DBG_CS_LEVEL])
		aStack[i,HB_DBG_CS_MODULE] := procFile(d-aStack[i,HB_DBG_CS_LEVEL])
		aStack[i,HB_DBG_CS_FUNCTION] := ProcName(d-aStack[i,HB_DBG_CS_LEVEL])
		hb_inetSend(t_oDebugInfo['socket'], aStack[i,HB_DBG_CS_MODULE]+ ;
			":"+alltrim(str(aStack[i,HB_DBG_CS_LINE]))+ ;
			":"+aStack[i,HB_DBG_CS_FUNCTION]+CRLF)
	next
return

static function format(value) 
	switch valtype(value)
		case "U"
			return "nil"
		case "C"
		case "M"
			if at('"',value)==0
				return '"'+value+'"'
			elseif at("'",value)==0
				return "'"+value+"'"
			else
				return "["+value+"]" //i don't like it decontexted 
			endif
		case "N"
			return alltrim(str(value))
		case "L"
			return iif(value,".T.",".F.")
		case "D"
			return 'd"'+left(hb_TsToStr(value),10)+'"'
		case "T"
			return 't"'+hb_TsToStr(value)+'"'
		case "A"
		case "H"
			return alltrim(str(len(value)))
		case "B"
			return "{|| ...}"
		case "O"
			//return value:ClassName()+" "+alltrim(str(len(value)))
			return value:ClassName()+" "+alltrim(str(len(__objGetMsgList(value,.T.,HB_MSGLISTALL))))
		case "P"
			return "Pointer"
		case "S"
			RETURN "@" + value:name + "()"
		endswitch
return ""

static function fixVarCParams(cParams, lenStack, lenVars) 
	local aParams := hb_aTokens(cParams,":")
	local iStack := lenStack-val(aParams[1])+1
	local iStart := val(aParams[2])
	local iCount := val(aParams[3])
	iStack:= iif(iStack>lenStack	, lenStack	, iStack)
	iStack:= iif(iStack<1			, 1				, iStack)
	if valType(lenVars) == "B"
		lenVars:=eval(lenVars,iStack)
	endif
	iStart:= iif(iStart>lenVars		, lenVars , iStart )
	iStart:= iif(iStart<1			, 1				, iStart )
	iCount:= iif(iCount<1			, lenVars , iCount )
return {iStack, iStart, iCount}

static procedure sendFromStack(cParams,prefix,DBG_CS) 
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local aStack := t_oDebugInfo['aStack']
	local aParams := fixVarCParams(cParams,len(aStack),{|iStack| len(aStack[iStack,DBG_CS])} )
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, aInfo, value, cLine
	hb_inetSend(t_oDebugInfo['socket'],prefix+" "+alltrim(str(iStack))+CRLF)
	for i:=iStart to iStart+iCount
		if(i>len(aStack[iStack,DBG_CS]))
			exit
		endif
		aInfo := aStack[iStack,DBG_CS,i]
		if DBG_CS == HB_DBG_CS_LOCALS
			value := __dbgVMVarLGet( __dbgProcLevel()-aInfo[ HB_DBG_VAR_FRAME ], aInfo[ HB_DBG_VAR_INDEX ] )
		else
			value := __dbgVMVarSGet( aInfo[ HB_DBG_VAR_FRAME ], aInfo[ HB_DBG_VAR_INDEX ] )
		endif
		// LOC:LEVEL:IDX::
		cLine := left(prefix,3) + ":" + alltrim(str(aInfo[ HB_DBG_VAR_FRAME ])) + ":" + ;
				 alltrim(str(aInfo[ HB_DBG_VAR_INDEX ])) + "::" + ;
				 aInfo[HB_DBG_VAR_NAME] + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oDebugInfo['socket'],cLine + CRLF )
	next
	hb_inetSend(t_oDebugInfo['socket'],"END"+CRLF)
return

static procedure sendFromInfo(prefix, cParams, HB_MV, lLocal) 
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local aStack := t_oDebugInfo['aStack']
	local nVars := __mvDbgInfo( HB_MV )
	local aParams := fixVarCParams(cParams,len(aStack),__mvDbgInfo( HB_MV ))
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, cLine, cName, value
	local nLocal := __mvDbgInfo( HB_MV_PRIVATE_LOCAL, aStack[iStack,HB_DBG_CS_LEVEL] )
	hb_inetSend(t_oDebugInfo['socket'],prefix+" "+alltrim(str(iStack))+CRLF)
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
		// PRI::i:
		cLine := left(prefix,3) + "::" + alltrim(str(i)) + "::" +;
				  cName + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oDebugInfo['socket'],cLine + CRLF )
	next

	hb_inetSend(t_oDebugInfo['socket'],"END"+CRLF)
return 

static function getValue(req) 
	local aInfos := hb_aTokens(req,":")
	local v, i, aIndices, cName
	switch aInfos[1]
		case "LOC"
			v := __dbgVMVarLGet(__dbgProcLevel()-val(aInfos[2]),val(aInfos[3]))
			exit
		case "STA"
			v := __dbgVMVarSGet(val(aInfos[2]),val(aInfos[3]))
			exit
		case "GLO"
		case "EXT"
			v := __dbgVMVarSGet(val(aInfos[2]),val(aInfos[3]))
			exit
		case "PRI"
			v := __mvDbgInfo(HB_MV_PRIVATE,val(aInfos[3]), @cName)
			exit
		case "PUB"
			v := __mvDbgInfo(HB_MV_PUBLIC,val(aInfos[3]), @cName)
			exit
		case "EXP"
			// TODO: aInfos[3] can include a : 
			v := evalExpression( aInfos[3], val(aInfos[2]))
	endswitch
	// some variable changes its type during execution. mha
	if at(valtype(v),"AHO") == 0
		return {}
	endif
	req := aInfos[1]+":"+aInfos[2]+":"+aInfos[3]+":"+aInfos[4]
	if len(aInfos[4])>0
		aIndices := hb_aTokens(aInfos[4],",")
		for i:=1 to len(aIndices)
			switch(valtype(v))
				case "A"
					v:=v[val(aIndices[i])]
					exit
				case "H"
					if i>len(v)
						v := nil
					else
						v := hb_HValueAt(v,val(aIndices[i]))
					endif
					exit
				case "O"
					v :=  __dbgObjGetValue(val(aInfos[2]),v,aIndices[i])
			endswitch
		next
	endif	
return v

STATIC FUNCTION __dbgObjGetValue( nProcLevel, oObject, cVar )

   LOCAL xResult
   LOCAL oErr

#ifdef __XHARBOUR__
   TRY
      xResult := dbgSENDMSG( nProcLevel, oObject, cVar )
   CATCH
      TRY
         xResult := dbgSENDMSG( 0, oObject, cVar )
      CATCH
         xResult := oErr:description
      END
   END
#else
   BEGIN SEQUENCE WITH {|| Break() }
      xResult := __dbgSENDMSG( nProcLevel, oObject, cVar )

   RECOVER
      BEGIN SEQUENCE WITH {| oErr | Break( oErr ) }
         /* Try to access variables using class code level */
         xResult := __dbgSENDMSG( 0, oObject, cVar )
      RECOVER USING oErr
         xResult := oErr:description
      END SEQUENCE
   END SEQUENCE
#endif
   RETURN xResult

static procedure sendCoumpoundVar(req, cParams ) 
	local value := getValue(@req)
	local aInfos := hb_aTokens(req,":")
	local aParams := fixVarCParams(cParams,1,len(value))
	local iStart := aParams[2]
	local iCount := aParams[3], nMax := len(value)
	local i, idx,vSend, cLine, aData, idx2
	LOCAL t_oDebugInfo := __DEBUGITEM()
	//? "sendCoumpoundVar",req,cParams
	if valtype(value) == "O"
		//aData := __objGetValueList(value) // , value:aExcept())
		aData :=   __objGetMsgList( value )
		aParams := fixVarCParams(cParams,1,len(aData))
		iStart := aParams[2]
		iCount := aParams[3]
		nMax := len(aData)
	endif
	hb_inetSend(t_oDebugInfo['socket'],req+CRLF)
	if right(req,1)<>":"
		req+=","
	endif
	for i:=iStart to iStart+iCount
	//for i:=1 to nVars
		if i > nMax
			loop
		endif
		switch(valtype(value))
			case "A"
				idx2 := idx := alltrim(str(i))
				vSend:=value[i]
				exit
			case "H"
				vSend:=hb_HValueAt(value,i)
				idx2 := format(hb_HKeyAt(value,i))
				idx := alltrim(str(i))
				exit
			case "O"
				idx2 := idx := aData[i]
				vSend := __dbgObjGetValue(VAL(aInfos[2]),value, aData[i])
				exit
		endswitch
		cLine := req + idx + ":" +;
			idx2 + ":" + valtype(vSend) + ":" + format(vSend)
		hb_inetSend(t_oDebugInfo['socket'],cLine + CRLF )
	next

	hb_inetSend(t_oDebugInfo['socket'],"END"+CRLF)	
return

// returns -1 if the module is not valid, 0 if the line is not valid, 1 in case of valid line
static function IsValidStopLine(cModule,nLine) 
	LOCAL iModule
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local nIdx, nInfo, tmp
	cModule := alltrim(cModule)
	iModule := aScan(t_oDebugInfo['aModules'],{|v| v[1]=cModule})
	if iModule=0
		return -1
	endif
	if nLine<t_oDebugInfo['aModules'][iModule,2]
		return 0
	endif
	nIdx := nLine - t_oDebugInfo['aModules'][iModule,2]
	tmp := Int(nIdx/8)
	if tmp>=len(t_oDebugInfo['aModules'][iModule,3])
		return 0
	endif
	nInfo = Asc(SubStr(t_oDebugInfo['aModules'][iModule,3],tmp+1,1))
return HB_BITAND(HB_BITSHIFT(nInfo, -(nIdx-tmp*8)),1)

static procedure setBreakpoint(cInfo) 
	LOCAL aInfos := hb_aTokens(cInfo,":"), idLine
	local nReq, nLine, nReason
	LOCAL t_oDebugInfo := __DEBUGITEM()
	nReq := val(aInfos[3])
	if aInfos[1]=="-"
		// remove
		if hb_HHasKey(t_oDebugInfo['aBreaks'],aInfos[2])
			idLine := aScan(t_oDebugInfo['aBreaks'][aInfos[2]], {|v| v=nReq })
			if idLine>0
				aDel(t_oDebugInfo['aBreaks'][aInfos[2]],idLine)
			endif
		endif
		hb_inetSend(t_oDebugInfo['socket'],"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:request"+CRLF)
		return
	endif
	if aInfos[1]<>"+"
		hb_inetSend(t_oDebugInfo['socket'],"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid request"+CRLF)
		return
	endif
	nLine := nReq
	while (nReason:=IsValidStopLine(aInfos[2],nLine))!=1
		nLine++
		if (nLine-nReq)>2
			exit
		endif
	enddo
	if nReason!=1
		nLine := nReq - 1
		while (nReason:=IsValidStopLine(aInfos[2],nLine))!=1
			nLine--
			if (nReq-nLine)>2
				exit
			endif
		enddo
	endif
	if nReason!=1
		if nReason==0
			hb_inetSend(t_oDebugInfo['socket'],"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid"+CRLF)
		else
			hb_inetSend(t_oDebugInfo['socket'],"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:notfound"+CRLF)
		endif
		return
	endif
	if .not. hb_HHasKey(t_oDebugInfo['aBreaks'],aInfos[2])
		t_oDebugInfo['aBreaks'][aInfos[2]] := {}
	endif
	idLine := aScan(t_oDebugInfo['aBreaks'][aInfos[2]], {|v| v=nLine })
	if(idLine=0)
		aadd(t_oDebugInfo['aBreaks'][aInfos[2]],nLine)
	endif
	hb_inetSend(t_oDebugInfo['socket'],"BREAK:"+aInfos[2]+":"+aInfos[3]+":"+alltrim(str(nLine))+CRLF)
return

static function inBreakpoint() 
	LOCAL aBreaks := __DEBUGITEM()['aBreaks']
//	LOCAL aInfos := t_oDebugInfo['aStack',len(t_oDebugInfo['aStack'])]
	LOCAL nLine := procLine(3)
	local idLine, cFile := procFile(3)
	if .not. hb_HHasKey(aBreaks,cFile)
		return .F.
	endif
	idLine := aScan(aBreaks[cFile], {|v| v=nLine })
return idLine<>0

//#define SAVEMODULES 
static procedure AddModule(aInfo) 
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local i, idx
	#ifdef SAVEMODULES
		local j, tmp, cc,fFileModules
		if !file("modules.dbg")
			fclose(fcreate("modules.dbg"))
		endif
		fFileModules := fopen("modules.dbg",1+64)
		fSeek(fFileModules,0,2)
	#endif
	for i:=1 to len(aInfo)
		aInfo[i,1] := alltrim(aInfo[i,1])
		if len(aInfo[i,1])=0
			loop
		endif
		idx := aScan(t_oDebugInfo['aModules'], {|v| aInfo[i,1]=v[1]})
		if idx=0
			aadd(t_oDebugInfo['aModules'],aInfo[i])
		else
			t_oDebugInfo['aModules'][idx] := aInfo[i]
		endif
		
		#ifdef SAVEMODULES
			fWrite(fFileModules,aInfo[i,1]+str(aInfo[i,2])+e"\r\n")
			for j:=1 to len(aInfo[i,3])*8
				tmp := Int(j/8)
				cc := asc(substr(aInfo[i,3],tmp+1,1))
				fWrite(fFileModules,str(j+aInfo[i,2])+str(HB_BITAND(HB_BITSHIFT(cc, -(j-tmp*8)),1))+str(cc)+e"\r\n")
				//? j, HB_BITAND(HB_BITSHIFT(cc, -(j-tmp*8)),1), cc
			next
		#endif
	next
	#ifdef SAVEMODULES
		fclose(fFileModules)
	#endif
return

static function replaceExpression(xExpr, __dbg, name, value) 
	local aMatches := HB_REGEXALL("\b"+name+"\b",xExpr,.F./*CASE*/,/*line*/,/*nMat*/,/*nGet*/,.F.)
	local i
	if len(aMatches)=0
		return xExpr
	endif
	aadd(__dbg, value )
	for i:=len(aMatches) to 1 step -1
		xExpr := left(xExpr,aMatches[i,1,2]-1) + "__dbg[" + allTrim(str(len(__dbg))) +"]" + substr(xExpr,aMatches[i,1,3]+1)
	next
return xExpr

static function evalExpression( xExpr, level ) 
	local oErr, xResult, __dbg := {}
	local i, cName, v
	LOCAL t_oDebugInfo := __DEBUGITEM()
	local aStack := t_oDebugInfo['aStack',len(t_oDebugInfo['aStack'])-level+1]
	//? "Expression:", xExpr
	xExpr := strTran(xExpr,";",":")
	// replace all locals
	for i:=1 to len(aStack[HB_DBG_CS_LOCALS])
		xExpr := replaceExpression(xExpr, @__dbg, aStack[HB_DBG_CS_LOCALS,i,HB_DBG_VAR_NAME], ;
					__dbgVMVarLGet(__dbgProcLevel()-aStack[HB_DBG_CS_LOCALS,i,HB_DBG_VAR_FRAME],aStack[HB_DBG_CS_LOCALS,i,HB_DBG_VAR_INDEX]))
	next
	// replace all proc statics
	for i:=1 to len(aStack[HB_DBG_CS_STATICS])
		xExpr := replaceExpression(xExpr, @__dbg, aStack[HB_DBG_CS_STATICS,i,HB_DBG_VAR_NAME], ;
					__dbgVMVarSGet(__dbgProcLevel()-aStack[HB_DBG_CS_STATICS,i,HB_DBG_VAR_FRAME],aStack[HB_DBG_CS_STATICS,i,HB_DBG_VAR_INDEX]))
	next
	// replace all public
	for i:=1 to __mvDbgInfo( HB_MV_PUBLIC )
		v:=__mvDbgInfo( HB_MV_PUBLIC, i, @cName )
		xExpr := replaceExpression(xExpr, @__dbg, cName, v)
	next
	// replace all private
	for i:=1 to __mvDbgInfo( HB_MV_PRIVATE )
		v:=__mvDbgInfo( HB_MV_PRIVATE, i, @cName )
		xExpr := replaceExpression(xExpr, @__dbg, cName, v)
	next
	// ******
	BEGIN SEQUENCE WITH {|oErr| BREAK( oErr ) }
		xResult := Eval(&("{|__dbg| "+xExpr+"}"),__dbg)
	RECOVER USING oErr
		xResult := oErr
	END SEQUENCE
return xResult

static procedure sendExpression( xExpr ) 
	LOCAL xResult
	   LOCAL cType, level, iDots := at(":",xExpr)
	   LOCAL t_oDebugInfo := __DEBUGITEM()
	level := val(left(xExpr,iDots))
	xResult :=  evalExpression( substr(xExpr,iDots+1), level)
	if valtype(xResult)="O" .and. xResult:ClassName() == "ERROR"
		cType := "E"
		xResult := xResult:description
	else
		cType := valtype(xResult)
		xResult := format(xResult)
	ENDIF
	hb_inetSend(t_oDebugInfo['socket'],"EXPRESSION:"+alltrim(str(level))+":"+cType+":"+xResult+CRLF)
return

STATIC PROCEDURE ErrorBlockCode( e )
	LOCAL t_oDebugInfo := __DEBUGITEM()
	hb_inetSend(t_oDebugInfo['socket'],"ERROR:"+e:Description+CRLF)
	t_oDebugInfo['lRunning'] := .F.
	CheckSocket(.T.)
	__DEBUGITEM(t_oDebugInfo)
	if t_oDebugInfo['errorBlock']!=nil
		eval(t_oDebugInfo['errorBlock'], e)
	endif

PROCEDURE __dbgEntry( nMode, uParam1, uParam2, uParam3 )
	local tmp
	LOCAL t_oDebugInfo
	if nMode = HB_DBG_GETENTRY
		return
	endif
	t_oDebugInfo := __DEBUGITEM()
	switch nMode
		case HB_DBG_MODULENAME
			if(empty(t_oDebugInfo))
				t_oDebugInfo := { ;
					'socket' =>  nil, ;
					'lRunning' =>  .F., ;
					'aBreaks' =>  {=>}, ;
					'aStack' =>  {}, ;
					'aModules' =>  {}, ;
					'maxLevel' =>  nil, ;
					'bInitStatics' =>  .F., ;
					'bInitGlobals' =>  .F., ;
					'bInitLines' =>  .F., ;
					'errorBlock' => nil ;
				}
				__DEBUGITEM(t_oDebugInfo)
				#ifdef SAVEMODULES
					ferase("modules.dbg")
				#endif
			endif
			if at("_INITSTATICS", uParam1)<>0
				t_oDebugInfo['bInitStatics'] := .T.
			elseif at("_INITGLOBALS", uParam1)<>0
				t_oDebugInfo['bInitGlobals'] := .T.
			elseif at("_INITLINES", uParam1)<>0
				t_oDebugInfo['bInitLines'] := .T.
			endif
			tmp := hb_aTokens(uParam1,":") //1,2 file,function
			aadd(tmp,procLine(__dbgProcLevel()-1)) // line
			aadd(tmp,__dbgProcLevel()-1) //level
			aadd(tmp,{}) //locals
			aadd(tmp,{}) //statics
			//? "MODULENAME", uParam1, uParam2, uParam3, valtype(uParam1), valtype(uParam2), valtype(uParam3),  __dbgProcLevel()-1,procLine(__dbgProcLevel()-1)
			aAdd(t_oDebugInfo['aStack'], tmp)
			exit
		case HB_DBG_LOCALNAME
			if t_oDebugInfo['bInitGlobals']
				//? "LOCALNAME" + len(t_oDebugInfo['aStack'])
			else
				aAdd(t_oDebugInfo['aStack'][len(t_oDebugInfo['aStack'])][HB_DBG_CS_LOCALS], {uParam2, uParam1, "L", __dbgProcLevel()-1})
			endif
			exit
		case HB_DBG_STATICNAME
			if t_oDebugInfo['bInitStatics']
				//? "STATICNAME - bInitStatics", uParam1, uParam2, uParam3
			elseif t_oDebugInfo['bInitGlobals']
				//? "STATICNAME - bInitGlobals", uParam1, uParam2, uParam3
			else
				//? "STATICNAME", uParam1, uParam2, uParam3, valtype(uParam1), valtype(uParam2), valtype(uParam3),  __dbgProcLevel()
				//aEval(uParam1,{|x,n| QOut(n,valtype(x),x)})
				aAdd(t_oDebugInfo['aStack'][len(t_oDebugInfo['aStack'])][HB_DBG_CS_STATICS], {uParam3, uParam2, "S", __dbgProcLevel()})
			endif
			exit
		case HB_DBG_ENDPROC
			//? "EndPROC", uParam1, uParam2, uParam3, valtype(uParam1), valtype(uParam2), valtype(uParam3) 
			aSize(t_oDebugInfo['aStack'],len(t_oDebugInfo['aStack'])-1)
			if t_oDebugInfo['bInitLines']
				// I don't like this hack, shoud be better if in case of HB_DBG_ENDPROC 
				// uParam1 is the returned value, it allow to show it in watch too...
				*tmp := __GETLASTRETURN(10); ? 10,valtype(tmp),tmp
				tmp := __GETLASTRETURN(11)//; ? 11,valtype(tmp),tmp
				*tmp := __GETLASTRETURN(12); ? 10,valtype(tmp),tmp
				*tmp := __GETLASTRETURN(13); ? 13,valtype(tmp),tmp
				*tmp := __GETLASTRETURN(14); ? 14,valtype(tmp),tmp
				AddModule(tmp)
			endif
			t_oDebugInfo['bInitStatics'] := .F.
			t_oDebugInfo['bInitGlobals'] := .F.
			t_oDebugInfo['bInitLines'] := .F.
			exit
		case HB_DBG_SHOWLINE
			//TODO check if ErrorBlock is setted by user and save user's errorBlock
			/*tmp := ErrorBlock( {| e | ErrorBlockCode( e ) } )
			//? valtype(tmp)
			if tmp<>nil .and. t_oDebugInfo['errorBlock'] = nil
				t_oDebugInfo['errorBlock'] := tmp
			endif*/
			t_oDebugInfo['aStack'][len(t_oDebugInfo['aStack'])][HB_DBG_CS_LINE] := uParam1
			CheckSocket()
			__dbgInvokeDebug(.F.)
			exit
	endswitch

#pragma BEGINDUMP

#include <hbapi.h>
#include <hbstack.h>
#include <hbvmint.h>
#include <hbapiitm.h>
#include <stdio.h>

HB_FUNC( __GETLASTRETURN )
{
	PHB_ITEM pItem = hb_stackItemFromTop( -1-hb_parni(1) );
	hb_itemReturn( HB_IS_BYREF( pItem ) ? hb_itemUnRef( pItem ) : pItem );
}

static PHB_ITEM sDebugInfo = NULL;
HB_FUNC( __DEBUGITEM )
{
	if(!sDebugInfo)
	{
		sDebugInfo = hb_itemNew(0);
	}
	if(hb_pcount()>0)
	{
		hb_itemCopy(sDebugInfo, hb_param(1,HB_IT_ANY));
	}
	hb_itemReturn(sDebugInfo);
}

#pragma ENDDUMP
