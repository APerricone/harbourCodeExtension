// DO NOT REMOVE THIS PRAGMA
// if the debugger code has DEBUGINFO the program will crash for stack overflow 
#pragma DEBUGINFO=Off

#include <hbdebug.ch>
#include <hbmemvar.ch>
#include <hboo.ch>
#include <hbclass.ch>

thread static t_oDebugInfo := nil


class DebugInfo
	DATA socket INIT nil
	DATA lRunning AS LOGIC init .F.
	DATA aBreaks init {=>}
	DATA aStack init {}
	DATA aModules init {}
	data maxLevel init nil
	data bInitStatics as logic init .F.
	data bInitGlobals as logic init .F.
	data bInitLines as logic init .F.

	method CheckSocket(lStopSent)
	method AddModule(aInfo)

	method sendStack() hidden
	method format(value) hidden
	method fixVarCParams(cParams, lenStack, lenVars) hidden
	method sendFromInfo(prefix, cParams, HB_MV, lLocal) hidden
	method sendFromStack(cParams,prefix,DBG_CS) hidden
	method getValue(req) hidden
	method sendCoumpoundVar(req, cParams ) hidden
	method IsValidStopLine(cModule,nLine) hidden
	method setBreakpoint(cInfo) hidden
	method inBreakpoint() hidden
	method replaceExpression(xExpr, __dbg, name, value) hidden
	method evalExpression( xExpr, level ) hidden
	method sendExpression( xExpr ) hidden
endclass

#define CRLF e"\r\n"
#ifndef DBG_PORT
// Temp, I hope to find another way to do InterProcessCommunication that uses ProcessId as unique key
// in the meanwhile, you can change the port using compiler command line argumend -D to set DBG_PORT
// to another value, it is useful if you need to debug 2 programm in the same time.
#define DBG_PORT 6110
#endif


// returns .T. if need step
method procedure CheckSocket(lStopSent) class DebugInfo
	LOCAL tmp
	lStopSent := iif(empty(lStopSent),.F.,lStopSent)
	// if no server then start it.
	if(empty(::socket))
		hb_inetInit()
		::socket := hb_inetCreate()
		hb_inetTimeout( ::socket,1000 )
		hb_inetConnect("127.0.0.1",DBG_PORT,::socket)
	endif
	do while .T.
		//if hb_inetErrorCode(oSocket) <> 0
		//	//disconnected?
		//	OutErr(hb_inetErrorDesc(oSocket)+CRLF)
		//	::lRunning := .T.
		//	::aBreaks := {=>}
		//	::maxLevel := nil
		//	return 
		//
		if hb_inetDataReady(::socket) = 1
			tmp := hb_inetRecvLine(::socket)
		else
			tmp := ""
		endif
		if len(tmp)>0
			//? "<<", tmp
			if subStr(tmp,4,1)==":"
				::sendCoumpoundVar(tmp, hb_inetRecvLine(::socket))
				loop
			endif
			switch tmp
				case "PAUSE"
					::lRunning := .F.
					if .not. lStopSent
						hb_inetSend(::socket,"STOP:pause"+CRLF)
						lStopSent := .T.
					endif
					exit
				case "GO"
					::lRunning := .T.
					return
				case "STEP" // go to next line of code even if is in another procedure
					::lRunning := .F.
					return
				case "NEXT" // go to next line of same procedure
					::lRunning := .T.
					::maxLevel := __dbgProcLevel()
					return
				case "EXIT" // go to callee procedure
					::lRunning := .T.
					::maxLevel := __dbgProcLevel() -1
					return
				case "STACK" 
					::sendStack()
					exit
				case "BREAKPOINT"
					::setBreakpoint(hb_inetRecvLine(::socket))
					exit
				case "LOCALS"
					::sendFromStack(hb_inetRecvLine(::socket),tmp,HB_DBG_CS_LOCALS)
					exit							
				case "STATICS"
					::sendFromStack(hb_inetRecvLine(::socket),tmp,HB_DBG_CS_STATICS)
					exit
				case "PRIVATES"
					::sendFromInfo(tmp,hb_inetRecvLine(::socket),HB_MV_PRIVATE, .T.)
					exit
				case "PRIVATE_CALLEE"
					::sendFromInfo(tmp,hb_inetRecvLine(::socket),HB_MV_PRIVATE, .F.)
					exit
				case "PUBLICS"
					::sendFromInfo(tmp,hb_inetRecvLine(::socket),HB_MV_PUBLIC)
					exit
				//case "GLOBALS"
				//	sendVariables(HB_MV_PUBLIC,.F.)
				//	exit
				//case "EXTERNALS"
				//	sendVariables(HB_MV_PUBLIC,.F.)
				//	exit
				case "EXPRESSION"
					::sendExpression(hb_inetRecvLine(::socket))
					exit
			endswitch
		else
			if ::lRunning
				if ::inBreakpoint()
					::lRunning := .F.
					if .not. lStopSent
						hb_inetSend(::socket,"STOP:break"+CRLF)
						lStopSent := .T.
					endif
				endif
				if __dbgInvokeDebug(.F.)
					::lRunning := .F.
					if .not. lStopSent
						hb_inetSend(::socket,"STOP:AltD"+CRLF)
						lStopSent := .T.
					endif
				endif
				if .not. empty(::maxLevel) 
					if ::maxLevel < __dbgProcLevel()
						// we are not in the same procedure
						return
					endif
					::maxLevel := nil
					::lRunning := .F.
					if .not. lStopSent
						hb_inetSend(::socket,"STOP:next"+CRLF)
						lStopSent := .T.
					endif
				endif
			endif
			if ::lRunning 
				return
			endif
			if .not. lStopSent
				hb_inetSend(::socket,"STOP:step"+CRLF)
				lStopSent := .T.
			endif
			hb_idleSleep(0.1)
		endif	
	enddo
	// unreachable code
return

method procedure sendStack() class DebugInfo
	local i
	local aStack := ::aStack
	hb_inetSend(::socket,"STACK " + alltrim(str(len(aStack)))+CRLF)
	for i:=len(aStack) to 1 step -1
		hb_inetSend(::socket, aStack[i,HB_DBG_CS_MODULE]+ ;
			":"+alltrim(str(aStack[i,HB_DBG_CS_LINE]))+ ;
			":"+aStack[i,HB_DBG_CS_FUNCTION]+CRLF)
	next
return

method function format(value) class DebugInfo
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

method function fixVarCParams(cParams, lenStack, lenVars) class DebugInfo
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

method procedure sendFromStack(cParams,prefix,DBG_CS) class DebugInfo
	local aStack := ::aStack
	local aParams := ::fixVarCParams(cParams,len(aStack),{|iStack| len(aStack[iStack,DBG_CS])} )
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, aInfo, value, cLine
	hb_inetSend(::socket,prefix+" "+alltrim(str(iStack))+CRLF)
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
				 aInfo[HB_DBG_VAR_NAME] + ":" + valtype(value) + ":" + ::format(value)
		hb_inetSend(::socket,cLine + CRLF )
	next
	hb_inetSend(::socket,"END"+CRLF)
return

method procedure sendFromInfo(prefix, cParams, HB_MV, lLocal) class DebugInfo
	local aStack := ::aStack
	local nVars := __mvDbgInfo( HB_MV )
	local aParams := ::fixVarCParams(cParams,len(aStack),__mvDbgInfo( HB_MV ))
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, cLine, cName, value
	local nLocal := __mvDbgInfo( HB_MV_PRIVATE_LOCAL, aStack[iStack,HB_DBG_CS_LEVEL] )
	hb_inetSend(::socket,prefix+" "+alltrim(str(iStack))+CRLF)
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
				  cName + ":" + valtype(value) + ":" + ::format(value)
		hb_inetSend(::socket,cLine + CRLF )
	next

	hb_inetSend(::socket,"END"+CRLF)
return 

method function getValue(req) class DebugInfo
	local aInfos := hb_aTokens(req,":")
	local v, i, aIndices
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
			v := __mvDbgInfo(HB_MV_PRIVATE,val(aInfos[3]))
			exit
		case "PUB"
			v := __mvDbgInfo(HB_MV_PUBLIC,val(aInfos[3]))
			exit
		case "EXP"
			// TODO: aInfos[3] can include a : 
			v := ::evalExpression(aInfos[3], val(aInfos[2]))
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
					//TODO: support not character hashes keys
					v := hb_HGetDef(v,aIndices[i],nil)
					exit
				case "O"
					v :=  __objSendMsg(v,aIndices[i])
			endswitch
		next
	endif	
return v

method procedure sendCoumpoundVar(req, cParams ) class DebugInfo
	local value := ::getValue(@req)
	local aParams := ::fixVarCParams(cParams,1,len(value))
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, idx,vSend, cLine, aData
	if valtype(value) == "O"
		aData := __objGetValueList(value)
		aParams := ::fixVarCParams(cParams,1,len(aData))
		iStart := aParams[2]
		iCount := aParams[3]
	endif
	hb_inetSend(::socket,req+CRLF)
	if right(req,1)<>":"
		req+=","
	endif
	for i:=iStart to iStart+iCount
	//for i:=1 to nVars
		if i > len(Value)
			loop
		endif
		switch(valtype(value))
			case "A"
				idx := alltrim(str(i))
				vSend:=value[i]
				exit
			case "H"
				idx:=hb_HKeyAt(value,i)
				//TODO: support not character hashes keys
				vSend:=hb_HGetDef(value,idx,nil)
				exit
			case "O"
				idx := aData[i,1]
				vSend := aData[i,2]
				exit
		endswitch
		cLine := req + idx + ":" +;
				  idx + ":" + valtype(vSend) + ":" + ::format(vSend)
		hb_inetSend(::socket,cLine + CRLF )
	next

	hb_inetSend(::socket,"END"+CRLF)	
return

method function IsValidStopLine(cModule,nLine) class DebugInfo
	LOCAL iModule
	local nIdx, cInfo, tmp
	cModule := alltrim(cModule)
	iModule := aScan(::aModules,{|v| v[1]=cModule})
	if iModule=0
		return .F.
	endif
	if nLine<::aModules[iModule,2]
		return .F.
	endif
	nIdx := nLine - ::aModules[iModule,2]
	tmp := Int(nIdx/8)
	if tmp>len(::aModules[iModule,3])
		return .F.
	endif
	cInfo = Asc(SubStr(::aModules[iModule,3],tmp))
	nIdx -= tmp * 8
	cInfo := HB_BITAND(HB_BITSHIFT(cInfo, -nIdx),1)
return (cInfo = 1)

method procedure setBreakpoint(cInfo) class DebugInfo
	LOCAL aInfos := hb_aTokens(cInfo,":"), idLine
	local nReq, nLine
	nReq := val(aInfos[3])
	if aInfos[1]=="-"
		// remove
		if hb_HHasKey(::aBreaks,aInfos[2])
			idLine := aScan(::aBreaks[aInfos[2]], {|v| v=nReq })
			if idLine>0
				aDel(::aBreaks[aInfos[2]],idLine)
			endif
		endif
		hb_inetSend(::socket,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:request"+CRLF)
		return
	endif
	if aInfos[1]<>"+"
		hb_inetSend(::socket,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid request"+CRLF)
		return
	endif
	nLine := nReq
	while .not. ::IsValidStopLine(aInfos[2],nLine)
		nLine++
		if (nLine-nReq)>2
			exit
		endif
	enddo
	if .not. ::IsValidStopLine(aInfos[2],nLine)
		nLine := nReq - 1
		while .not. ::IsValidStopLine(aInfos[2],nLine)
			nLine--
			if (nReq-nLine)>2
				exit
			endif
		enddo
	endif
	if .not. ::IsValidStopLine(aInfos[2],nLine)
		hb_inetSend(::socket,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid"+CRLF)
		return
	endif
	if .not. hb_HHasKey(::aBreaks,aInfos[2])
		::aBreaks[aInfos[2]] := {}
	endif
	idLine := aScan(::aBreaks[aInfos[2]], {|v| v=nLine })
	if(idLine=0)
		aadd(::aBreaks[aInfos[2]],nLine)
	endif
	hb_inetSend(::socket,"BREAK:"+aInfos[2]+":"+aInfos[3]+":"+alltrim(str(nLine))+CRLF)
return

method function inBreakpoint() class DebugInfo
	LOCAL aInfos := ::aStack[len(::aStack)]
	local idLine, cFile := aInfos[HB_DBG_CS_MODULE]
	if .not. hb_HHasKey(::aBreaks,cFile)
		return .F.
	endif
	idLine := aScan(::aBreaks[cFile], {|v| v=aInfos[HB_DBG_CS_LINE] })
return idLine<>0

method procedure AddModule(aInfo) class DebugInfo
	local i, idx
	for i:=1 to len(aInfo)
		aInfo[i,1] := alltrim(aInfo[i,1])
		if len(aInfo[i,1])=0
			loop
		endif
		idx := aScan(::aModules, {|v| aInfo[i,1]=v[1]})
		if idx=0
			aadd(::aModules,aInfo[i])
		else
			::aModules[idx] := aInfo[i]
		endif
	next
return

method function replaceExpression(xExpr, __dbg, name, value) class DebugInfo
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

method function evalExpression( xExpr, level ) class DebugInfo
	local oErr, xResult, __dbg := {}
	local i, cName, v
	local aStack := ::aStack
	// replace all locals
	for i:=1 to len(aStack[level,HB_DBG_CS_LOCALS])
		xExpr := ::replaceExpression(xExpr, @__dbg, aStack[level,HB_DBG_CS_LOCALS,i,HB_DBG_VAR_NAME], ;
					__dbgVMVarLGet(__dbgProcLevel()-aStack[level,HB_DBG_CS_LOCALS,i,HB_DBG_VAR_FRAME],aStack[level,HB_DBG_CS_LOCALS,i,HB_DBG_VAR_INDEX]))
	next
	// replace all proc statics
	for i:=1 to len(aStack[level,HB_DBG_CS_STATICS])
		xExpr := ::replaceExpression(xExpr, @__dbg, aStack[level,HB_DBG_CS_STATICS,i,HB_DBG_VAR_NAME], ;
					__dbgVMVarSGet(aStack[level,HB_DBG_CS_STATICS,i,HB_DBG_VAR_FRAME],aStack[level,HB_DBG_CS_LOCALS,i,HB_DBG_VAR_INDEX]))
	next
	// replace all public
	for i:=1 to __mvDbgInfo( HB_MV_PUBLIC )
		v:=__mvDbgInfo( HB_MV_PUBLIC, i, @cName )
		xExpr := ::replaceExpression(xExpr, @__dbg, cName, v)
	next
	// replace all private
	for i:=1 to __mvDbgInfo( HB_MV_PRIVATE )
		v:=__mvDbgInfo( HB_MV_PRIVATE, i, @cName )
		xExpr := ::replaceExpression(xExpr, @__dbg, cName, v)
	next
	// ******
	BEGIN SEQUENCE WITH {|oErr| BREAK( oErr ) }
		xResult := Eval(&("{|__dbg| "+xExpr+"}"),__dbg)
	RECOVER USING oErr
		xResult := oErr
	END SEQUENCE
return xResult

method procedure sendExpression( xExpr ) class DebugInfo
	LOCAL xResult
   	LOCAL cType, level, iDots := at(":",xExpr)
	level := val(left(xExpr,iDots))
	xResult :=  ::evalExpression( substr(xExpr,iDots+1), level)
	if valtype(xResult)="O" .and. xResult:ClassName() == "ERROR"
		cType := "E"
		xResult := xResult:description
	else
		cType := valtype(xResult)
		xResult := ::format(xResult)
	ENDIF
	hb_inetSend(::socket,"EXPRESSION:"+alltrim(str(level))+":"+cType+":"+xResult+CRLF)
return

STATIC PROCEDURE ErrorBlockCode( e )
	hb_inetSend(t_oDebugInfo:socket,"ERROR:"+e:Description+CRLF)
	t_oDebugInfo:lRunning := .F.
	t_oDebugInfo:CheckSocket(.T.)

PROCEDURE __dbgEntry( nMode, uParam1, uParam2, uParam3 )
	local tmp
	//? "__dbgEntry",nMode, uParam1, uParam2, uParam3

	switch nMode
		case HB_DBG_MODULENAME
			if empty(t_oDebugInfo)
				t_oDebugInfo := DebugInfo():New()
			endif
			if at("_INITSTATICS", uParam1)<>0
				t_oDebugInfo:bInitStatics := .T.
			elseif at("_INITGLOBALS", uParam1)<>0
				t_oDebugInfo:bInitGlobals := .T.
			elseif at("_INITLINES", uParam1)<>0
				t_oDebugInfo:bInitLines := .T.
			endif
			tmp := hb_aTokens(uParam1,":") //1,2 file,function
			aadd(tmp,procLine(__dbgProcLevel()-1)) // line
			aadd(tmp,__dbgProcLevel()-1) //level
			aadd(tmp,{}) //locals
			aadd(tmp,{}) //statics
			aAdd(t_oDebugInfo:aStack, tmp)
			return
		case HB_DBG_LOCALNAME
			aAdd(t_oDebugInfo:aStack[len(t_oDebugInfo:aStack)][HB_DBG_CS_LOCALS], {uParam2, uParam1, "L", len(t_oDebugInfo:aStack)})
			return
		case HB_DBG_STATICNAME
			if t_oDebugInfo:bInitStatics
				//TODO
			elseif t_oDebugInfo:bInitGlobals
				//TODO
			else
				aAdd(t_oDebugInfo:aStack[len(t_oDebugInfo:aStack)][HB_DBG_CS_STATICS], {uParam3, uParam1, "S", uParam2})
			endif
			return
		case HB_DBG_ENDPROC
			aSize(t_oDebugInfo:aStack,len(t_oDebugInfo:aStack)-1)
			if t_oDebugInfo:bInitLines
				// I don't like this hack, shoud be better if in case of HB_DBG_ENDPROC 
				// uParam1 is the returned value, it allow to show it in watch too...
				tmp := __GETLASTRETURN(10) //; ? 10,valtype(tmp),tmp
				t_oDebugInfo:AddModule(tmp)
			endif
			t_oDebugInfo:bInitStatics := .F.
			t_oDebugInfo:bInitGlobals := .F.
			t_oDebugInfo:bInitLines := .F.
			return
		case HB_DBG_SHOWLINE
			//TODO check if ErrorBlock is setted by user and save user's errorBlock
			//ErrorBlock( {| e | ErrorBlockCode( e ) } )
			t_oDebugInfo:aStack[len(t_oDebugInfo:aStack)][HB_DBG_CS_LINE] := uParam1
			t_oDebugInfo:CheckSocket()
			__dbgInvokeDebug(.F.)
			return
	endswitch

#pragma BEGINDUMP

#include <hbapi.h>
#include <hbstack.h>
#include <hbvmint.h>
#include <hbapiitm.h>

HB_FUNC( __GETLASTRETURN )
{
	PHB_ITEM pItem = hb_stackItemFromTop( -1-hb_parni(1) );
	hb_itemReturn( HB_IS_BYREF( pItem ) ? hb_itemUnRef( pItem ) : pItem );
}

#pragma ENDDUMP
